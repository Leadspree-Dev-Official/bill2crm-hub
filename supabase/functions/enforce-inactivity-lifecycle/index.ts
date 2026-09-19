// Enforces the SaaS Inactivity Lifecycle Policy:
// 15 days inactivity -> Paused (no logins allowed until admin contacted)
// 30 days inactivity -> Suspended (admin section marked suspended, only admin can resume)
// 60 days inactivity -> Account and all associated data permanently deleted

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, mapOrgStatus, mapSubscriptionStatus, resolveAllAppTargets, resolveAppTarget, resolveAppTargetById } from '../_shared/webapp-bridge.ts'

interface LifecycleRunOptions {
  dryRun?: boolean
  tenantId?: string
}

interface InactivitySummary {
  tenantId: string
  businessName: string
  email: string | null
  inactiveDays: number
  previousStatus: string
  newStatus: string
  action: 'none' | 'paused' | 'suspended' | 'purged'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Authorization: Allow Super Admin JWT OR Cron Secret
    const authHeader = req.headers.get('Authorization')
    const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-lifecycle-secret')
    const expectedSecret = Deno.env.get('SYNC_WEBHOOK_SECRET') || Deno.env.get('CRON_SECRET')

    let isAuthorized = false
    let callerUserId: string | null = null

    if (cronSecretHeader && expectedSecret && cronSecretHeader === expectedSecret) {
      isAuthorized = true
    } else if (authHeader) {
      const ownAsCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: isSuperAdmin } = await ownAsCaller.rpc('is_super_admin')
      if (isSuperAdmin) {
        isAuthorized = true
        const { data: userData } = await ownAsCaller.auth.getUser()
        callerUserId = userData?.user?.id ?? null
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Super Admin or valid secret required.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json().catch(() => ({}))) as LifecycleRunOptions
    const dryRun = Boolean(body.dryRun)

    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 2. Fetch overview data
    const [authOverviewResult, tenantsResult, targets] = await Promise.all([
      ownService.rpc('admin_get_tenants_auth_overview'),
      ownService.from('tenants').select('*, tenant_subscriptions(*)'),
      resolveAllAppTargets(ownService).catch(() => []),
    ])

    const authMap = new Map<string, { email: string | null; controlPlaneLastSignInAt: string | null }>()
    for (const row of (authOverviewResult.data ?? []) as Array<{
      tenant_id: string
      owner_email: string | null
      control_plane_last_sign_in_at: string | null
    }>) {
      authMap.set(row.tenant_id, {
        email: row.owner_email,
        controlPlaneLastSignInAt: row.control_plane_last_sign_in_at,
      })
    }

    // 3. For each target, cache users and organization memberships for activity checks
    const targetUserCache = new Map<string, Map<string, { lastSignInAt: string | null; id: string }>>()
    const targetOrgMembersMap = new Map<string, Map<string, Array<{ userId: string; lastSignInAt: string | null }>>>()

    await Promise.all(
      targets.map(async (target) => {
        try {
          const targetClient = createClient(target.url, target.serviceRoleKey)
          const [usersResult, membersResult] = await Promise.all([
            targetClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
            targetClient.from('organization_memberships').select('organization_id, user_id'),
          ])

          const emailMap = new Map<string, { lastSignInAt: string | null; id: string }>()
          const userByIdMap = new Map<string, { lastSignInAt: string | null }>()

          for (const u of usersResult.data?.users ?? []) {
            if (u.email) {
              emailMap.set(u.email.toLowerCase(), {
                lastSignInAt: u.last_sign_in_at ?? null,
                id: u.id,
              })
            }
            userByIdMap.set(u.id, {
              lastSignInAt: u.last_sign_in_at ?? null,
            })
          }
          targetUserCache.set(target.targetId, emailMap)

          const orgMembers = new Map<string, Array<{ userId: string; lastSignInAt: string | null }>>()
          for (const m of membersResult.data ?? []) {
            const orgId = m.organization_id as string
            const uid = m.user_id as string
            const uInfo = userByIdMap.get(uid)
            if (!orgMembers.has(orgId)) {
              orgMembers.set(orgId, [])
            }
            orgMembers.get(orgId)!.push({
              userId: uid,
              lastSignInAt: uInfo?.lastSignInAt ?? null,
            })
          }
          targetOrgMembersMap.set(target.targetId, orgMembers)
        } catch (err) {
          console.error(`Failed to inspect target ${target.label}:`, err)
        }
      }),
    )

    const defaultTarget = targets.find((t) => t.isDefault)
    const defaultTargetId = defaultTarget?.targetId

    const summaries: InactivitySummary[] = []
    const now = Date.now()

    // 4. Process each tenant
    for (const t of (tenantsResult.data ?? []) as any[]) {
      if (body.tenantId && t.id !== body.tenantId) continue
      if (t.status === 'cancelled') continue // Already cancelled, skip

      const authInfo = authMap.get(t.id)
      const email = authInfo?.email || t.web_app_email || null
      const targetId = t.app_target_id || defaultTargetId

      // Determine all potential activity timestamps
      const activityTimestamps: number[] = [
        new Date(t.created_at).getTime(),
      ]

      if (t.last_activity_at) {
        activityTimestamps.push(new Date(t.last_activity_at).getTime())
      }

      if (authInfo?.controlPlaneLastSignInAt) {
        activityTimestamps.push(new Date(authInfo.controlPlaneLastSignInAt).getTime())
      }

      // Check owner and invited team member logins on the target Web App
      if (targetId) {
        if (email && targetUserCache.has(targetId)) {
          const u = targetUserCache.get(targetId)!.get(email.toLowerCase())
          if (u?.lastSignInAt) {
            activityTimestamps.push(new Date(u.lastSignInAt).getTime())
          }
        }

        if (t.web_app_org_id && targetOrgMembersMap.has(targetId)) {
          const members = targetOrgMembersMap.get(targetId)!.get(t.web_app_org_id) ?? []
          for (const member of members) {
            if (member.lastSignInAt) {
              activityTimestamps.push(new Date(member.lastSignInAt).getTime())
            }
          }
        }
      }

      const mostRecentActivity = Math.max(...activityTimestamps)
      const inactiveDays = Math.floor((now - mostRecentActivity) / (1000 * 60 * 60 * 24))

      let action: 'none' | 'paused' | 'suspended' | 'purged' = 'none'
      let newStatus = t.status

      if (inactiveDays >= 60) {
        // Stage 3: 60+ days -> Purge and delete all data
        action = 'purged'
        newStatus = 'purged'
        if (!dryRun) {
          await purgeTenantFull(ownService, t, targetId)
        }
      } else if (inactiveDays >= 30) {
        // Stage 2: 30-59 days -> Auto-suspend
        if (t.status !== 'suspended') {
          action = 'suspended'
          newStatus = 'suspended'
          if (!dryRun) {
            await setTenantStatus(ownService, t.id, 'suspended', callerUserId, 'inactivity_auto_suspend', inactiveDays)
          }
        }
      } else if (inactiveDays >= 15) {
        // Stage 1: 15-29 days -> Auto-pause
        if (t.status !== 'paused' && t.status !== 'suspended') {
          action = 'paused'
          newStatus = 'paused'
          if (!dryRun) {
            await setTenantStatus(ownService, t.id, 'paused', callerUserId, 'inactivity_auto_pause', inactiveDays)
          }
        }
      }

      summaries.push({
        tenantId: t.id,
        businessName: t.business_name,
        email,
        inactiveDays,
        previousStatus: t.status,
        newStatus,
        action,
      })
    }

    const pausedCount = summaries.filter((s) => s.action === 'paused').length
    const suspendedCount = summaries.filter((s) => s.action === 'suspended').length
    const purgedCount = summaries.filter((s) => s.action === 'purged').length

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        totalChecked: summaries.length,
        pausedCount,
        suspendedCount,
        purgedCount,
        summaries,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('enforce-inactivity-lifecycle failed:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error in inactivity lifecycle' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

async function setTenantStatus(
  own: any,
  tenantId: string,
  newStatus: 'paused' | 'suspended',
  actorUserId: string | null,
  actionName: string,
  inactiveDays: number,
) {
  // Update control plane
  await own.from('tenant_subscriptions').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId)
  await own.from('tenants').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', tenantId)

  await own.from('admin_audit_log').insert({
    actor_user_id: actorUserId,
    action: actionName,
    target_tenant_id: tenantId,
    payload: { status: newStatus, inactiveDays, enforcedAt: new Date().toISOString() },
  })

  // Sync to Web App target
  try {
    const { url, serviceRoleKey } = await resolveAppTarget(own, tenantId)
    const webApp = createClient(url, serviceRoleKey)
    const { data: tenant } = await own.from('tenants').select('web_app_org_id, web_app_email').eq('id', tenantId).single()
    if (tenant?.web_app_org_id) {
      const orgStatus = mapOrgStatus(newStatus)
      const subStatus = mapSubscriptionStatus(newStatus)
      await webApp.from('organizations').update({ status: orgStatus, updated_at: new Date().toISOString() }).eq('id', tenant.web_app_org_id)
      await webApp.from('organization_subscriptions').update({ status: subStatus, updated_at: new Date().toISOString() }).eq('organization_id', tenant.web_app_org_id)
    }
  } catch (syncErr) {
    console.warn(`Sync to Web App failed during ${actionName} for tenant ${tenantId}:`, syncErr)
  }
}

async function purgeTenantFull(own: any, tenant: any, targetId?: string) {
  // Purge in Web App
  try {
    const { url, serviceRoleKey } = targetId
      ? await resolveAppTargetById(own, targetId)
      : await resolveAppTarget(own, tenant.id)
    const webApp = createClient(url, serviceRoleKey)
    const orgId = tenant.web_app_org_id
    const cleanEmail = tenant.web_app_email?.trim().toLowerCase()

    if (orgId || cleanEmail) {
      const tablesToClean = [
        'tenant_data',
        'scheduled_posts',
        'document_shares',
        'appointments',
        'voice_logs',
        'chat_sessions',
        'webhook_events',
        'credit_reservations',
        'tenant_api_configs',
      ]

      for (const tbl of tablesToClean) {
        if (cleanEmail) {
          await webApp.from(tbl).delete().eq('tenant_email', cleanEmail)
        }
      }

      if (orgId) {
        const { data: memberships } = await webApp.from('organization_memberships').select('user_id').eq('organization_id', orgId)
        await webApp.from('organization_subscriptions').delete().eq('organization_id', orgId)
        await webApp.from('organization_memberships').delete().eq('organization_id', orgId)
        await webApp.from('organizations').delete().eq('id', orgId)

        for (const m of memberships ?? []) {
          if (m.user_id) {
            await webApp.auth.admin.deleteUser(m.user_id)
          }
        }
      }

      // Purge storage buckets
      const buckets = ['marketing-media', 'legal-vault']
      for (const b of buckets) {
        try {
          if (cleanEmail) {
            const { data: files } = await webApp.storage.from(b).list(cleanEmail)
            if (files && files.length > 0) {
              const paths = files.map((f: any) => `${cleanEmail}/${f.name}`)
              await webApp.storage.from(b).remove(paths)
            }
          }
        } catch {}
      }
    }
  } catch (purgeAppErr) {
    console.warn('Web App wipe encountered error during 60-day purge:', purgeAppErr)
  }

  // Purge in Control Plane
  await own.from('admin_audit_log').insert({
    action: 'inactivity_60_day_purge',
    target_tenant_id: tenant.id,
    payload: { businessName: tenant.business_name, purgedAt: new Date().toISOString() },
  })

  // Delete tenant record in control plane
  await own.from('tenants').delete().eq('id', tenant.id)
}

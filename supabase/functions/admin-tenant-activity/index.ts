// Returns real-time Web App and Control Plane last sign-in activity for all tenants.
// Restricted to authenticated Super Admins only.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, resolveAllAppTargets } from '../_shared/webapp-bridge.ts'

export interface TenantActivityItem {
  email: string | null
  controlPlaneLastSignInAt: string | null
  webAppLastSignInAt: string | null
  webAppExists: boolean
  activeUsers?: number
  totalMembers?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const own = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await own.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: isSuperAdmin } = await own.rpc('is_super_admin')
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Super Admin privileges required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Fetch control-plane tenant auth overview & tenant target mappings
    const [authOverviewResult, tenantsResult, targets] = await Promise.all([
      ownService.rpc('admin_get_tenants_auth_overview'),
      ownService.from('tenants').select('id, app_target_id, web_app_email, web_app_org_id'),
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

    // 2. For each target, list users to match emails and last_sign_in_at, plus memberships
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
          if (!usersResult.data?.users) return

          const emailMap = new Map<string, { lastSignInAt: string | null; id: string }>()
          const userByIdMap = new Map<string, { lastSignInAt: string | null }>()
          for (const u of usersResult.data.users) {
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
          for (const m of (membersResult.data ?? []) as Array<{ organization_id: string; user_id: string }>) {
            const orgId = m.organization_id
            const uid = m.user_id
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
          console.error(`Failed to fetch users from target ${target.label}:`, err)
        }
      }),
    )

    // Identify the default target ID for unassigned tenants
    const defaultTarget = targets.find((t) => t.isDefault)
    const defaultTargetId = defaultTarget?.targetId

    // 3. Assemble response per tenant
    const activity: Record<string, TenantActivityItem> = {}

    for (const t of (tenantsResult.data ?? []) as Array<{
      id: string
      app_target_id: string | null
      web_app_email: string | null
      web_app_org_id: string | null
    }>) {
      const authInfo = authMap.get(t.id)
      const email = authInfo?.email || t.web_app_email || null
      const targetId = t.app_target_id || defaultTargetId

      let webAppLastSignInAt: string | null = null
      let webAppExists = false
      let activeUsers = 1
      let totalMembers = 1

      if (targetId && email && targetUserCache.has(targetId)) {
        const usersInTarget = targetUserCache.get(targetId)!
        const match = usersInTarget.get(email.toLowerCase())
        if (match) {
          webAppExists = true
          webAppLastSignInAt = match.lastSignInAt
        }
      }

      if (targetId && t.web_app_org_id && targetOrgMembersMap.has(targetId)) {
        const members = targetOrgMembersMap.get(targetId)!.get(t.web_app_org_id) ?? []
        if (members.length > 0) {
          totalMembers = members.length
          const activeCount = members.filter((m) => m.lastSignInAt != null).length
          activeUsers = Math.max(1, activeCount)
        }
      } else if (webAppExists) {
        totalMembers = 1
        activeUsers = 1
      }

      activity[t.id] = {
        email,
        controlPlaneLastSignInAt: authInfo?.controlPlaneLastSignInAt ?? null,
        webAppLastSignInAt,
        webAppExists,
        activeUsers,
        totalMembers,
      }
    }

    return new Response(JSON.stringify({ activity }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-tenant-activity error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error fetching tenant activity' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

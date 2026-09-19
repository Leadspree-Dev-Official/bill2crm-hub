// Returns real-time Web App and Control Plane last sign-in activity for all tenants.
// Restricted to authenticated Super Admins only.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, resolveAllAppTargets } from '../_shared/webapp-bridge.ts'

export interface TenantActivityItem {
  email: string | null
  controlPlaneLastSignInAt: string | null
  webAppLastSignInAt: string | null
  webAppExists: boolean
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
      ownService.from('tenants').select('id, app_target_id, web_app_email'),
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

    // 2. For each target, list users to match emails and last_sign_in_at
    const targetUserCache = new Map<string, Map<string, { lastSignInAt: string | null; id: string }>>()

    await Promise.all(
      targets.map(async (target) => {
        try {
          const targetClient = createClient(target.url, target.serviceRoleKey)
          const { data, error } = await targetClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
          if (error || !data?.users) return

          const emailMap = new Map<string, { lastSignInAt: string | null; id: string }>()
          for (const u of data.users) {
            if (u.email) {
              emailMap.set(u.email.toLowerCase(), {
                lastSignInAt: u.last_sign_in_at ?? null,
                id: u.id,
              })
            }
          }
          targetUserCache.set(target.targetId, emailMap)
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
    }>) {
      const authInfo = authMap.get(t.id)
      const email = authInfo?.email || t.web_app_email || null
      const targetId = t.app_target_id || defaultTargetId

      let webAppLastSignInAt: string | null = null
      let webAppExists = false

      if (targetId && email && targetUserCache.has(targetId)) {
        const usersInTarget = targetUserCache.get(targetId)!
        const match = usersInTarget.get(email.toLowerCase())
        if (match) {
          webAppExists = true
          webAppLastSignInAt = match.lastSignInAt
        }
      }

      activity[t.id] = {
        email,
        controlPlaneLastSignInAt: authInfo?.controlPlaneLastSignInAt ?? null,
        webAppLastSignInAt,
        webAppExists,
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

// Called from the /admin console's "Purge" action. Removes the tenant's organization,
// subscription, memberships, and auth identity from the Web App project (direct table access
// via its service_role key — see _shared/webapp-bridge.ts for why), then purges the local
// control-plane record through the gated admin_purge_tenant() RPC (using the caller's own JWT,
// so authorization + audit logging happen exactly as they would for any other admin action).
//
// This does not purge the Web App's tenant-scoped app data (invoices, documents, etc.) — that
// still needs that project's own `delete-tenant` Edge Function / manual cleanup for a fully
// complete wipe. Documented in supabase/README.md.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, resolveAppTarget } from '../_shared/webapp-bridge.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const ownAsCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: isSuperAdmin } = await ownAsCaller.rpc('is_super_admin')
    if (!isSuperAdmin) return new Response('Not authorized', { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      tenantId?: string
      action?: string
      userIds?: string[]
      targetId?: string
    }

    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Handle Retry of Failed Identities directly
    if (body.action === 'retry_users' && Array.isArray(body.userIds) && body.userIds.length > 0) {
      const { url, serviceRoleKey } = await resolveAppTarget(ownService, undefined, body.targetId)
      const webApp = createClient(url, serviceRoleKey)
      const remainingFailures: { userId: string; error: string }[] = []

      for (const userId of body.userIds) {
        const { error: deleteUserError } = await webApp.auth.admin.deleteUser(userId)
        if (deleteUserError) {
          console.warn('Retry failed to delete Web App auth user', userId, deleteUserError)
          remainingFailures.push({ userId, error: deleteUserError.message })
        }
      }

      return new Response(JSON.stringify({ ok: true, partialFailures: remainingFailures }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { tenantId } = body
    if (!tenantId) return new Response(JSON.stringify({ error: 'tenantId is required' }), { status: 400 })

    const { data: tenant } = await ownService.from('tenants').select('web_app_org_id').eq('id', tenantId).maybeSingle()

    // Auth-identity deletions that fail mid-purge are collected here and returned to the caller
    // instead of only being console.warn'd — a tenant can otherwise look fully purged in the
    // admin UI while an orphaned login identity remains in the Web App's Supabase project.
    const partialFailures: { userId: string; error: string }[] = []

    if (tenant?.web_app_org_id) {
      const { url, serviceRoleKey } = await resolveAppTarget(ownService, tenantId)
      const webApp = createClient(url, serviceRoleKey)
      const orgId = tenant.web_app_org_id as string

      const { data: memberships } = await webApp
        .from('organization_memberships')
        .select('user_id')
        .eq('organization_id', orgId)

      await webApp.from('organization_subscriptions').delete().eq('organization_id', orgId)
      await webApp.from('organization_memberships').delete().eq('organization_id', orgId)
      await webApp.from('organizations').delete().eq('id', orgId)

      for (const membership of memberships ?? []) {
        const userId = membership.user_id as string
        const { error: deleteUserError } = await webApp.auth.admin.deleteUser(userId)
        if (deleteUserError) {
          console.warn('Could not delete Web App auth user', userId, deleteUserError)
          partialFailures.push({ userId, error: deleteUserError.message })
        }
      }
    }

    const { error: purgeError } = await ownAsCaller.rpc('admin_purge_tenant', { p_tenant_id: tenantId })
    if (purgeError) throw purgeError

    return new Response(JSON.stringify({ ok: true, partialFailures }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-purge-tenant failed', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

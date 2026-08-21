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
import { corsHeaders, webAppEnv } from '../_shared/webapp-bridge.ts'

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

    const { tenantId } = (await req.json()) as { tenantId: string }
    if (!tenantId) return new Response(JSON.stringify({ error: 'tenantId is required' }), { status: 400 })

    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: tenant } = await ownService.from('tenants').select('web_app_org_id').eq('id', tenantId).maybeSingle()

    if (tenant?.web_app_org_id) {
      const { url, serviceRoleKey } = webAppEnv()
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
        await webApp.auth.admin.deleteUser(membership.user_id as string).catch((err) => {
          console.warn('Could not delete Web App auth user', membership.user_id, err)
        })
      }
    }

    const { error: purgeError } = await ownAsCaller.rpc('admin_purge_tenant', { p_tenant_id: tenantId })
    if (purgeError) throw purgeError

    return new Response(JSON.stringify({ ok: true }), {
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

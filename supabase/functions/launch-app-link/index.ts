// Called by the authenticated dashboard's "Launch my app" button. Mints a fresh, short-lived
// Supabase magic-link into the tenant's Web App workspace and returns it — generated on demand
// per click, never stored, so there's no bookmarkable static link floating around.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, resolveAppTarget } from '../_shared/webapp-bridge.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const own = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await own.auth.getUser()
    if (userError || !user?.email) return new Response('Unauthorized', { status: 401 })

    const { data: tenant, error: tenantError } = await own
      .from('tenants')
      .select('id, subdomain_slug, status')
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: 'No workspace found for this account' }), { status: 404 })
    }
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      return new Response(JSON.stringify({ error: `Workspace is ${tenant.status}. Contact support.` }), {
        status: 403,
      })
    }

    const rootDomain = Deno.env.get('ROOT_DOMAIN') ?? 'bill2crm.in'
    // Root path, not a specific route: the Web App's routing is hand-rolled off
    // window.location.pathname (no React Router / catch-all), so redirecting anywhere but "/"
    // risks landing on an unrecognized path. ssoCallback.ts only reads the hash fragment and
    // strips it back to pathname + search, so root is also where the user ends up after login.
    const redirectTo = `https://${tenant.subdomain_slug}.${rootDomain}/`

    // resolve_app_target is service_role-only, so this needs its own client — `own` above is
    // authenticated as the calling user, which that RPC deliberately can't be called as.
    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { url, serviceRoleKey } = await resolveAppTarget(ownService, tenant.id)
    const webApp = createClient(url, serviceRoleKey)

    const { data, error } = await webApp.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: { redirectTo },
    })

    if (error || !data?.properties?.action_link) {
      throw error ?? new Error('No action_link returned')
    }

    return new Response(JSON.stringify({ url: data.properties.action_link }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('launch-app-link failed', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

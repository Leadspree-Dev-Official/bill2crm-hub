// Called by the authenticated dashboard's "Launch my app" button. Mints a fresh, short-lived
// Supabase magic-link into the tenant's Web App workspace and returns it — generated on demand
// per click, never stored, so there's no bookmarkable static link floating around.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, resolveAppTarget } from '../_shared/webapp-bridge.ts'

/** Every response needs the CORS headers, failures included. Without them the browser blocks
 *  the dashboard from reading the body, so supabase-js surfaces only its generic
 *  "Edge Function returned a non-2xx status code" and the real reason is lost. */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Not signed in' }, 401)

    const own = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await own.auth.getUser()
    if (userError || !user?.email) return json({ error: 'Not signed in' }, 401)

    const { data: tenant, error: tenantError } = await own
      .from('tenants')
      .select('id, subdomain_slug, status')
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (tenantError || !tenant) {
      return json({ error: 'No workspace found for this account' }, 404)
    }
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      return json({ error: `Workspace is ${tenant.status}. Contact support.` }, 403)
    }

    // resolve_app_target is service_role-only, so this needs its own client — `own` above is
    // authenticated as the calling user, which that RPC deliberately can't be called as.
    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { url, appBaseUrl, serviceRoleKey } = await resolveAppTarget(ownService, tenant.id)

    // Where the browser is sent after the link is consumed. The target's own address wins;
    // <slug>.<ROOT_DOMAIN> is only the legacy wildcard-subdomain fallback for a target that
    // has no app_base_url stored yet. That fallback was the bug this replaced: the live fleet
    // serves one host per server (https://bill2crm.leadspree.in), not one host per tenant, and
    // the derived leadspree.bill2crm.in has no DNS record.
    //
    // Root path, not a specific route: the Web App's routing is hand-rolled off
    // window.location.pathname (no React Router / catch-all), so redirecting anywhere but "/"
    // risks landing on an unrecognized path. ssoCallback.ts only reads the hash fragment and
    // strips it back to pathname + search, so root is also where the user ends up after login.
    const rootDomain = Deno.env.get('ROOT_DOMAIN') ?? 'bill2crm.in'
    const redirectTo = appBaseUrl
      ? `${appBaseUrl.replace(/\/+$/, '')}/`
      : `https://${tenant.subdomain_slug}.${rootDomain}/`

    const webApp = createClient(url, serviceRoleKey)

    const { data, error } = await webApp.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: { redirectTo },
    })

    if (error || !data?.properties?.action_link) {
      // Name the address in the message: the two failures this call actually hits in practice
      // are "the email has no user on that server yet" and "redirectTo isn't in that project's
      // allowed redirect URLs", and neither is diagnosable without knowing where it pointed.
      const reason = error?.message ?? 'No action_link returned'
      throw new Error(`Could not mint a sign-in link for ${redirectTo} — ${reason}`)
    }

    return json({ url: data.properties.action_link, redirectTo })
  } catch (err) {
    console.error('launch-app-link failed', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

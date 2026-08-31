// Triggered by Supabase Database Webhooks on INSERT to `tenants` and UPDATE to
// `tenant_subscriptions` (configured in the dashboard — see supabase/README.md). Pushes this
// project's entitlement for a tenant into the Web App project's `organizations` /
// `organization_subscriptions` tables, and makes sure a matching auth identity exists there.
//
// verify_jwt is off for this function (see supabase/config.toml) — Database Webhooks don't
// carry a user session, so this checks a shared secret header instead.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, mapOrgStatus, mapSubscriptionStatus, resolveAppTarget, type OwnTenantStatus } from '../_shared/webapp-bridge.ts'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE'
  table: 'tenants' | 'tenant_subscriptions'
  record: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const expectedSecret = Deno.env.get('SYNC_WEBHOOK_SECRET')
  if (!expectedSecret || req.headers.get('x-webhook-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const payload = (await req.json()) as WebhookPayload
    const tenantId =
      payload.table === 'tenants' ? (payload.record.id as string) : (payload.record.tenant_id as string)

    const own = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: tenant, error: tenantError } = await own
      .from('tenants')
      .select('*, tenant_subscriptions(*, subscription_plans(*))')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: tenantError?.message ?? 'Tenant not found' }), { status: 404 })
    }

    const rawSubscription = tenant.tenant_subscriptions
    const subscription = Array.isArray(rawSubscription) ? rawSubscription[0] : rawSubscription
    const rawPlan = subscription?.subscription_plans
    const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan
    if (!subscription || !plan) {
      return new Response(JSON.stringify({ error: 'Tenant has no subscription/plan yet' }), { status: 200 })
    }

    const { data: authUser } = await own.auth.admin.getUserById(tenant.owner_user_id)
    const email = authUser?.user?.email
    if (!email) {
      return new Response(JSON.stringify({ error: 'Could not resolve owner email' }), { status: 404 })
    }

    const { url, serviceRoleKey } = await resolveAppTarget(own, tenantId)
    const webApp = createClient(url, serviceRoleKey)

    // Ensure a matching identity exists in the Web App project. If the Web App's own signup
    // trigger fires from this insert, it may create a baseline trial org first — the upsert
    // below immediately corrects it to this project's authoritative entitlement.
    const { error: createUserError } = await webApp.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { workspaceName: tenant.business_name },
    })
    if (createUserError && !createUserError.message.toLowerCase().includes('already')) {
      throw createUserError
    }

    const orgStatus = mapOrgStatus(tenant.status as OwnTenantStatus)
    const { data: existingOrg } = await webApp
      .from('organizations')
      .select('id')
      .eq('primary_email', email)
      .maybeSingle()

    let orgId = existingOrg?.id as string | undefined
    if (orgId) {
      await webApp.from('organizations').update({ name: tenant.business_name, status: orgStatus }).eq('id', orgId)
    } else {
      const { data: newOrg, error: insertOrgError } = await webApp
        .from('organizations')
        .insert({ name: tenant.business_name, primary_email: email, status: orgStatus })
        .select('id')
        .single()
      if (insertOrgError) throw insertOrgError
      orgId = newOrg.id as string
    }

    const endsAt =
      subscription.status === 'trial' ? subscription.trial_ends_at : subscription.current_period_end

    // The two projects keep independent subscription_plans tables, so a plan
    // here only maps across if a super admin filled in its "Web App plan ID"
    // (/admin -> Plans). Falling back to this project's own id silently entitles
    // the tenant to whatever plan happens to share that id on the other side —
    // or to nothing at all. Surfacing it as a hard failure keeps a mis-mapped
    // plan from being sold: the webhook retries, and the admin sees the error.
    const mappedPlanId = plan.web_app_plan_id
    if (!mappedPlanId) {
      throw new Error(
        `Plan "${plan.id}" has no Web App plan ID mapped. Set it in /admin -> Plans ` +
        `before entitlements for this plan can sync.`,
      )
    }

    const { error: subError } = await webApp.from('organization_subscriptions').upsert({
      organization_id: orgId,
      plan_id: mappedPlanId,
      status: mapSubscriptionStatus(tenant.status as OwnTenantStatus),
      starts_at: subscription.created_at,
      ends_at: endsAt,
      user_limit_override: subscription.user_limit_override,
      database_limit_override: subscription.storage_limit_override_mb,
    })
    if (subError) throw subError

    await own.from('tenants').update({ web_app_org_id: orgId, web_app_email: email }).eq('id', tenantId)

    return new Response(JSON.stringify({ ok: true, orgId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('sync-tenant-to-webapp failed', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

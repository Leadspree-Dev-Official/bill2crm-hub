// Triggered by Supabase Database Webhooks on INSERT to `tenants` and UPDATE to
// `tenant_subscriptions` (configured in the dashboard — see supabase/README.md), OR invoked
// directly by Super Admin callers (e.g. resumeTenant). Pushes this project's entitlement for a
// tenant into the Web App project's `organizations` / `organization_subscriptions` tables, and
// makes sure a matching auth identity exists there.
//
// Supports dual auth:
// 1. Shared secret header `x-webhook-secret` (for automated Database Webhooks without user sessions).
// 2. Super Admin Bearer JWT (for authenticated control plane actions).

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
  const webhookSecret = req.headers.get('x-webhook-secret')
  let isAuthorized = Boolean(expectedSecret && webhookSecret === expectedSecret)

  if (!isAuthorized) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const ownAsCaller = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: isSuperAdmin } = await ownAsCaller.rpc('is_super_admin')
      if (isSuperAdmin) {
        isAuthorized = true
      }
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
      return new Response(JSON.stringify({ error: tenantError?.message ?? 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawSubscription = tenant.tenant_subscriptions
    const subscription = Array.isArray(rawSubscription) ? rawSubscription[0] : rawSubscription
    const rawPlan = subscription?.subscription_plans
    const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan
    if (!subscription || !plan) {
      return new Response(JSON.stringify({ error: 'Tenant has no subscription/plan yet' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: authUser } = await own.auth.admin.getUserById(tenant.owner_user_id)
    const email = authUser?.user?.email
    if (!email) {
      return new Response(JSON.stringify({ error: 'Could not resolve owner email' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { url, serviceRoleKey } = await resolveAppTarget(own, tenantId)
    const webApp = createClient(url, serviceRoleKey)

    // Ensure a matching identity exists in the Web App project. If the Web App's own signup
    // trigger fires from this insert, it may create a baseline trial org first — the upsert
    // below immediately corrects it to this project's authoritative entitlement.
    // The password here is deliberately random AND discarded — nobody ever learns it. The
    // owner is meant to arrive by magic link, not by typing it. But that leaves them the one
    // account in the workspace with no usable password (their own staff get one chosen for
    // them in HRMS), so must_set_password marks them for a one-time "choose your password"
    // prompt on first launch. Without it, any failed link locks the owner out of their own
    // workspace with nothing to type and no password to reset.
    const { error: createUserError } = await webApp.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { workspaceName: tenant.business_name, must_set_password: true },
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

    // Ensure initial default AI credits exist for this tenant in tenant_data
    try {
      const creditKey = `tenant_${email}_api_credits`
      const { data: existingCreditRow } = await webApp
        .from('tenant_data')
        .select('value')
        .eq('key', creditKey)
        .maybeSingle()

      if (!existingCreditRow) {
        await webApp.from('tenant_data').insert({
          tenant_email: email,
          key: creditKey,
          value: '1000',
          updated_at: new Date().toISOString(),
        })
      }
    } catch (creditErr) {
      console.warn('Could not seed initial AI credits:', creditErr)
    }

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

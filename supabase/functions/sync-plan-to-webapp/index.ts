// Called after a plan is saved in /admin -> Plans. Pushes the plan definition (limits and
// feature flags) into the default Web App project's own `subscription_plans` table via direct
// service-role writes (bypasses RLS — see _shared/webapp-bridge.ts), so Site's plan editor is
// authoritative for what each plan unlocks there. Web App's own local Super Admin surface has
// been deactivated for exactly this reason (see supabase/migrations on both projects).
//
// Known limitations:
// - Web App's plan model has a single price/currency/billingCycle, not Site's three (monthly/
//   yearly/lifetime) prices — monthly is used as the canonical price pushed into feature_flags.
// - resolveAppTarget() with no tenantId resolves only the *default* app link. If more than one
//   distinct Web App project is ever registered, this only pushes to the default one.

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

    const { planId } = (await req.json()) as { planId: string }
    if (!planId) return new Response(JSON.stringify({ error: 'planId is required' }), { status: 400 })

    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: plan, error: planError } = await ownService
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: planError?.message ?? 'Plan not found' }), { status: 404 })
    }

    const { url, serviceRoleKey } = await resolveAppTarget(ownService)
    const webApp = createClient(url, serviceRoleKey)

    const flags = (plan.feature_flags as Record<string, unknown>) ?? {}
    const { error: upsertError } = await webApp.from('subscription_plans').upsert(
      {
        id: plan.web_app_plan_id || plan.id,
        name: plan.name,
        user_limit: plan.user_limit ?? -1,
        database_limit: plan.storage_limit_mb ?? -1,
        periodic_limit: plan.periodic_limit ?? -1,
        feature_flags: {
          vaultAccess: flags.vaultAccess !== false,
          vaultFileLimit: typeof flags.vaultFileLimit === 'number' ? flags.vaultFileLimit : -1,
          aiAgentsAccess: flags.aiAgentsAccess !== false,
          allowReceiptAttachments: flags.allowReceiptAttachments !== false,
          cloudSchedulingAccess: flags.cloudSchedulingAccess === true,
          price: plan.price_monthly_inr ?? 0,
          currency: 'INR',
          billingCycle: 'Monthly',
        },
        active: plan.is_active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('sync-plan-to-webapp failed', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Edge Function: billing-checkout
// Initiates a Razorpay checkout for a tenant:
//   - Monthly / Yearly recurring subscription (if recurring_mode is 'auto' and plan is mapped)
//   - Or Razorpay order for one cycle / lifetime (if recurring_mode is 'manual' or lifetime)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  corsHeaders,
  jsonResponse,
  razorpayCredentials,
  createOrder,
  createSubscription,
  createCustomer,
} from '../_shared/razorpay.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Not signed in' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Authenticated user client
    const own = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await own.auth.getUser()
    if (userError || !user?.email) return jsonResponse({ error: 'Not signed in' }, 401)

    // Service role client for ledger writes and customer management
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: tenant, error: tenantError } = await own
      .from('tenants')
      .select('id, business_name, subdomain_slug, status')
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (tenantError || !tenant) {
      return jsonResponse({ error: 'No workspace found for this account' }, 404)
    }

    const body = await req.json()
    const { planId, billingCycle } = body as {
      planId: string
      billingCycle: 'monthly' | 'yearly' | 'lifetime'
    }

    if (!planId || !billingCycle || !['monthly', 'yearly', 'lifetime'].includes(billingCycle)) {
      return jsonResponse({ error: 'Invalid plan or billing cycle' }, 400)
    }

    // Lifetime license is restricted exclusively to Private Cloud and only for Trial/Free workspaces.
    // Private Cloud deploys on an isolated dedicated database server instance, so active subscribers
    // on shared multi-tenant servers cannot switch directly.
    if (billingCycle === 'lifetime') {
      if (planId !== 'plan_private_cloud' && planId !== 'plan_private_cloud_lifetime') {
        return jsonResponse(
          { error: 'Lifetime license is only available for Private Cloud' },
          400,
        )
      }
      if (tenant.status !== 'trial' && tenant.status !== 'free') {
        return jsonResponse(
          {
            error:
              'Lifetime license is only available for Trial or Free workspaces migrating to dedicated Private Cloud. Active subscribers on shared servers cannot switch directly because Private Cloud runs on a separate dedicated server.',
          },
          400,
        )
      }
    }

    // Read plan details
    const { data: plan, error: planError } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .maybeSingle()

    if (planError || !plan) {
      return jsonResponse({ error: 'Plan not found or inactive' }, 404)
    }

    // Read billing config
    const { data: config } = await admin
      .from('billing_config')
      .select('*')
      .eq('id', true)
      .maybeSingle()

    if (config && !config.razorpay_enabled) {
      return jsonResponse(
        { error: 'Razorpay checkout is temporarily disabled. Please use WhatsApp/direct payment.' },
        400,
      )
    }

    const gstPercent = config?.gst_percent ?? 18
    const recurringMode = config?.recurring_mode ?? 'auto'

    // Calculate base price and tax
    let baseInr: number | null = null
    if (billingCycle === 'monthly') baseInr = plan.price_monthly_inr
    else if (billingCycle === 'yearly') baseInr = plan.price_yearly_inr
    else if (billingCycle === 'lifetime') baseInr = plan.price_lifetime_inr

    if (baseInr === null || baseInr <= 0) {
      return jsonResponse({ error: `Plan ${plan.name} has no price for ${billingCycle}` }, 400)
    }

    const basePaise = Math.round(baseInr * 100)
    const taxPaise = Math.round((basePaise * gstPercent) / 100)
    const totalPaise = basePaise + taxPaise

    const creds = razorpayCredentials()

    // Ensure Razorpay customer exists
    let razorpayCustomerId: string | null = null
    const { data: customerRow } = await admin
      .from('billing_customers')
      .select('razorpay_customer_id')
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    if (customerRow?.razorpay_customer_id) {
      razorpayCustomerId = customerRow.razorpay_customer_id
    } else {
      try {
        const cust = await createCustomer(creds, {
          name: tenant.business_name,
          email: user.email,
        })
        razorpayCustomerId = cust.id
        await admin.from('billing_customers').upsert({
          tenant_id: tenant.id,
          razorpay_customer_id: cust.id,
          email: user.email,
        })
      } catch (err) {
        console.warn('Could not register Razorpay customer:', err)
      }
    }

    const receipt = `rcpt_${tenant.id.slice(0, 8)}_${Date.now()}`.slice(0, 40)
    const notes = {
      tenant_id: tenant.id,
      plan_id: plan.id,
      billing_cycle: billingCycle,
    }

    // 1-Time / Lifetime flow: Always create a Razorpay Order
    if (billingCycle === 'lifetime') {
      const order = await createOrder(creds, {
        amountPaise: totalPaise,
        currency: 'INR',
        receipt,
        notes,
      })

      await admin.from('billing_orders').insert({
        tenant_id: tenant.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
        purpose: 'one_time',
        razorpay_order_id: order.id,
        amount_paise: basePaise,
        tax_paise: taxPaise,
        currency: 'INR',
        receipt,
        status: 'created',
        notes,
      })

      return jsonResponse({
        mode: 'order',
        orderId: order.id,
        amountPaise: totalPaise,
        basePaise,
        taxPaise,
        currency: 'INR',
        keyId: creds.keyId,
        planName: plan.name,
        businessName: tenant.business_name,
        email: user.email,
      })
    }

    // Monthly / Yearly recurring flow
    if (recurringMode === 'auto') {
      // Check gateway plan map
      const { data: mapRow } = await admin
        .from('plan_gateway_map')
        .select('razorpay_plan_id')
        .eq('plan_id', plan.id)
        .eq('billing_cycle', billingCycle)
        .eq('is_active', true)
        .maybeSingle()

      if (mapRow?.razorpay_plan_id) {
        const sub = await createSubscription(creds, {
          razorpayPlanId: mapRow.razorpay_plan_id,
          totalCount: billingCycle === 'monthly' ? 120 : 10,
          customerId: razorpayCustomerId ?? undefined,
          notes,
        })

        await admin.from('billing_subscriptions').insert({
          tenant_id: tenant.id,
          plan_id: plan.id,
          billing_cycle: billingCycle,
          mode: 'subscription',
          provider: 'razorpay',
          razorpay_subscription_id: sub.id,
          status: 'created',
          notes,
        })

        return jsonResponse({
          mode: 'subscription',
          subscriptionId: sub.id,
          keyId: creds.keyId,
          planName: plan.name,
          businessName: tenant.business_name,
          email: user.email,
        })
      }
    }

    // If recurringMode === 'manual' or plan is not mapped to Razorpay plan ID:
    // Fall back to 1-cycle order mode so checkout does not fail!
    const order = await createOrder(creds, {
      amountPaise: totalPaise,
      currency: 'INR',
      receipt,
      notes,
    })

    await admin.from('billing_orders').insert({
      tenant_id: tenant.id,
      plan_id: plan.id,
      billing_cycle: billingCycle,
      purpose: 'new',
      razorpay_order_id: order.id,
      amount_paise: basePaise,
      tax_paise: taxPaise,
      currency: 'INR',
      receipt,
      status: 'created',
      notes,
    })

    return jsonResponse({
      mode: 'order',
      orderId: order.id,
      amountPaise: totalPaise,
      basePaise,
      taxPaise,
      currency: 'INR',
      keyId: creds.keyId,
      planName: plan.name,
      businessName: tenant.business_name,
      email: user.email,
    })
  } catch (err: any) {
    console.error('billing-checkout error:', err)
    return jsonResponse({ error: err?.message || 'Checkout failed' }, 500)
  }
})

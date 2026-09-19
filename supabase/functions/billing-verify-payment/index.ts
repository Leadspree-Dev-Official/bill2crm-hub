// Edge Function: billing-verify-payment
// Server-side verification for payments made in Razorpay Checkout modal.
// Verifies HMAC-SHA256 signature and invokes billing_apply_payment RPC.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  corsHeaders,
  jsonResponse,
  razorpayCredentials,
  verifyOrderPaymentSignature,
  verifySubscriptionPaymentSignature,
  fetchPayment,
} from '../_shared/razorpay.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Not signed in' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const own = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await own.auth.getUser()
    if (userError || !user?.email) return jsonResponse({ error: 'Not signed in' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const creds = razorpayCredentials()

    const body = await req.json()
    const { mode, razorpayPaymentId, razorpayOrderId, razorpaySubscriptionId, razorpaySignature } = body as {
      mode: 'order' | 'subscription'
      razorpayPaymentId: string
      razorpayOrderId?: string
      razorpaySubscriptionId?: string
      razorpaySignature: string
    }

    if (!razorpayPaymentId || !razorpaySignature) {
      return jsonResponse({ error: 'Missing payment ID or signature' }, 400)
    }

    // Verify cryptographic signature
    if (mode === 'subscription') {
      if (!razorpaySubscriptionId) {
        return jsonResponse({ error: 'Missing razorpaySubscriptionId' }, 400)
      }
      const valid = await verifySubscriptionPaymentSignature({
        subscriptionId: razorpaySubscriptionId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
        keySecret: creds.keySecret,
      })
      if (!valid) {
        return jsonResponse({ error: 'Invalid subscription signature' }, 400)
      }

      // Read subscription record
      const { data: subRow, error: subErr } = await admin
        .from('billing_subscriptions')
        .select('*')
        .eq('razorpay_subscription_id', razorpaySubscriptionId)
        .maybeSingle()

      if (subErr || !subRow) {
        return jsonResponse({ error: 'Subscription not found' }, 404)
      }

      // Verify ownership
      const { data: isOwner } = await own.rpc('is_tenant_owner', { p_tenant_id: subRow.tenant_id })
      if (!isOwner) return jsonResponse({ error: 'Not authorized for this workspace' }, 403)

      // Calculate amount
      const { data: basePaise } = await admin.rpc('billing_plan_price_paise', {
        p_plan_id: subRow.plan_id,
        p_cycle: subRow.billing_cycle,
      })
      const { data: taxPaise } = await admin.rpc('billing_tax_paise', {
        p_base_paise: basePaise ?? 0,
      })

      // Apply payment and extend entitlement
      const { data: paymentId, error: applyError } = await admin.rpc('billing_apply_payment', {
        p_tenant_id: subRow.tenant_id,
        p_plan_id: subRow.plan_id,
        p_billing_cycle: subRow.billing_cycle,
        p_amount_paise: basePaise ?? 0,
        p_method: 'razorpay',
        p_tax_paise: taxPaise ?? 0,
        p_razorpay_payment_id: razorpayPaymentId,
        p_razorpay_subscription_id: razorpaySubscriptionId,
        p_captured_at: new Date().toISOString(),
        p_recorded_by: user.id,
        p_note: `Razorpay mandate authorization ${razorpaySubscriptionId}`,
      })

      if (applyError) {
        console.error('Error applying subscription payment:', applyError)
        return jsonResponse({ error: applyError.message }, 500)
      }

      return jsonResponse({ ok: true, paymentId })
    } else {
      // Order mode (one-time / lifetime or manual renewal cycle)
      if (!razorpayOrderId) {
        return jsonResponse({ error: 'Missing razorpayOrderId' }, 400)
      }
      const valid = await verifyOrderPaymentSignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
        keySecret: creds.keySecret,
      })
      if (!valid) {
        return jsonResponse({ error: 'Invalid order signature' }, 400)
      }

      const { data: orderRow, error: orderErr } = await admin
        .from('billing_orders')
        .select('*')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle()

      if (orderErr || !orderRow) {
        return jsonResponse({ error: 'Order not found' }, 404)
      }

      const { data: isOwner } = await own.rpc('is_tenant_owner', { p_tenant_id: orderRow.tenant_id })
      if (!isOwner) return jsonResponse({ error: 'Not authorized for this workspace' }, 403)

      const { data: paymentId, error: applyError } = await admin.rpc('billing_apply_payment', {
        p_tenant_id: orderRow.tenant_id,
        p_plan_id: orderRow.plan_id,
        p_billing_cycle: orderRow.billing_cycle,
        p_amount_paise: orderRow.amount_paise,
        p_method: 'razorpay',
        p_tax_paise: orderRow.tax_paise,
        p_razorpay_payment_id: razorpayPaymentId,
        p_razorpay_order_id: razorpayOrderId,
        p_captured_at: new Date().toISOString(),
        p_recorded_by: user.id,
        p_note: `Razorpay order payment ${razorpayOrderId}`,
      })

      if (applyError) {
        console.error('Error applying order payment:', applyError)
        return jsonResponse({ error: applyError.message }, 500)
      }

      return jsonResponse({ ok: true, paymentId })
    }
  } catch (err: any) {
    console.error('billing-verify-payment error:', err)
    return jsonResponse({ error: err?.message || 'Payment verification failed' }, 500)
  }
})

// Edge Function: billing-webhook
// Ingests webhooks from Razorpay with signature verification and idempotency.
// Handles auto-debits (subscription.charged), orders, failures, and subscription lifecycle.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  corsHeaders,
  jsonResponse,
  razorpayWebhookSecret,
  verifyWebhookSignature,
  fromUnix,
} from '../_shared/razorpay.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  let eventId = req.headers.get('x-razorpay-event-id')
  const signature = req.headers.get('x-razorpay-signature')

  const rawBody = await req.text()

  // Verify HMAC-SHA256 signature
  const webhookSecret = razorpayWebhookSecret()
  const isValid = await verifyWebhookSignature({
    rawBody,
    signature: signature || '',
    webhookSecret,
  })

  if (!isValid) {
    console.error('Webhook signature mismatch')
    return jsonResponse({ error: 'Signature verification failed' }, 400)
  }

  let eventPayload: any
  try {
    eventPayload = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const eventType: string = eventPayload.event || 'unknown'
  if (!eventId) {
    eventId =
      eventPayload.event_id ||
      eventPayload.id ||
      (eventPayload.payload?.payment?.entity?.id
        ? `${eventType}_${eventPayload.payload.payment.entity.id}`
        : null) ||
      (eventPayload.payload?.subscription?.entity?.id
        ? `${eventType}_${eventPayload.payload.subscription.entity.id}`
        : null) ||
      (eventPayload.payload?.order?.entity?.id
        ? `${eventType}_${eventPayload.payload.order.entity.id}`
        : null) ||
      `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  // Idempotency: claim the event. If already claimed, return 200 without reprocessing.
  const { data: claimed, error: claimErr } = await admin.rpc('billing_claim_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: eventPayload,
    p_tenant_id: null,
  })

  if (claimErr) {
    console.error('billing_claim_event error:', claimErr)
  }

  if (claimed === false) {
    return jsonResponse({ received: true, note: 'duplicate event already processed' }, 200)
  }

  try {
    // 1. Auto-debit renewal or single charge on mandate
    if (eventType === 'subscription.charged') {
      const subEntity = eventPayload.payload?.subscription?.entity
      const paymentEntity = eventPayload.payload?.payment?.entity

      if (subEntity && paymentEntity) {
        const subId = subEntity.id
        const paymentId = paymentEntity.id
        const amountPaise = paymentEntity.amount

        // Find subscription in our DB
        const { data: subRow } = await admin
          .from('billing_subscriptions')
          .select('*')
          .eq('razorpay_subscription_id', subId)
          .maybeSingle()

        if (subRow) {
          const { data: basePaise } = await admin.rpc('billing_plan_price_paise', {
            p_plan_id: subRow.plan_id,
            p_cycle: subRow.billing_cycle,
          })
          const { data: taxPaise } = await admin.rpc('billing_tax_paise', {
            p_base_paise: basePaise ?? amountPaise,
          })

          await admin.rpc('billing_apply_payment', {
            p_tenant_id: subRow.tenant_id,
            p_plan_id: subRow.plan_id,
            p_billing_cycle: subRow.billing_cycle,
            p_amount_paise: basePaise ?? amountPaise,
            p_method: 'razorpay',
            p_tax_paise: taxPaise ?? 0,
            p_razorpay_payment_id: paymentId,
            p_razorpay_subscription_id: subId,
            p_captured_at: fromUnix(paymentEntity.created_at) || new Date().toISOString(),
            p_note: `Subscription auto-debit charge ${subId}`,
          })

          // Sync subscription state
          await admin.rpc('billing_sync_subscription', {
            p_razorpay_subscription_id: subId,
            p_status: subEntity.status,
            p_current_period_start: fromUnix(subEntity.current_start),
            p_current_period_end: fromUnix(subEntity.current_end),
            p_charge_at: fromUnix(subEntity.charge_at),
            p_paid_count: subEntity.paid_count,
            p_short_url: subEntity.short_url,
          })
        }
      }
    }

    // 2. Order payment captured (one-time or manual order renewal)
    else if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = eventPayload.payload?.payment?.entity
      const orderId = paymentEntity?.order_id

      if (orderId) {
        const { data: orderRow } = await admin
          .from('billing_orders')
          .select('*')
          .eq('razorpay_order_id', orderId)
          .maybeSingle()

        if (orderRow) {
          await admin.rpc('billing_apply_payment', {
            p_tenant_id: orderRow.tenant_id,
            p_plan_id: orderRow.plan_id,
            p_billing_cycle: orderRow.billing_cycle,
            p_amount_paise: orderRow.amount_paise,
            p_method: 'razorpay',
            p_tax_paise: orderRow.tax_paise,
            p_razorpay_payment_id: paymentEntity.id,
            p_razorpay_order_id: orderId,
            p_captured_at: fromUnix(paymentEntity.created_at) || new Date().toISOString(),
            p_note: `Order payment captured ${orderId}`,
          })
        }
      }
    }

    // 3. Payment failed
    else if (eventType === 'payment.failed') {
      const paymentEntity = eventPayload.payload?.payment?.entity
      if (paymentEntity) {
        let tenantId: string | null = null

        if (paymentEntity.order_id) {
          const { data: o } = await admin
            .from('billing_orders')
            .select('tenant_id')
            .eq('razorpay_order_id', paymentEntity.order_id)
            .maybeSingle()
          tenantId = o?.tenant_id ?? null
        }

        if (!tenantId && paymentEntity.subscription_id) {
          const { data: s } = await admin
            .from('billing_subscriptions')
            .select('tenant_id')
            .eq('razorpay_subscription_id', paymentEntity.subscription_id)
            .maybeSingle()
          tenantId = s?.tenant_id ?? null
        }

        if (tenantId) {
          await admin.rpc('billing_record_failure', {
            p_tenant_id: tenantId,
            p_razorpay_payment_id: paymentEntity.id,
            p_amount_paise: paymentEntity.amount,
            p_reason: paymentEntity.error_description || 'Payment failure',
            p_razorpay_subscription_id: paymentEntity.subscription_id ?? null,
            p_razorpay_order_id: paymentEntity.order_id ?? null,
          })
        }
      }
    }

    // 4. Subscription lifecycle updates
    else if (eventType.startsWith('subscription.')) {
      const subEntity = eventPayload.payload?.subscription?.entity
      if (subEntity) {
        await admin.rpc('billing_sync_subscription', {
          p_razorpay_subscription_id: subEntity.id,
          p_status: subEntity.status,
          p_current_period_start: fromUnix(subEntity.current_start),
          p_current_period_end: fromUnix(subEntity.current_end),
          p_charge_at: fromUnix(subEntity.charge_at),
          p_paid_count: subEntity.paid_count,
          p_short_url: subEntity.short_url,
        })
      }
    }

    // Mark event as cleanly processed
    await admin.rpc('billing_finish_event', {
      p_event_id: eventId,
      p_error: null,
    })

    return jsonResponse({ received: true }, 200)
  } catch (err: any) {
    console.error(`Error processing webhook event ${eventType}:`, err)
    await admin.rpc('billing_finish_event', {
      p_event_id: eventId,
      p_error: err?.message || 'Processing error',
    })
    return jsonResponse({ error: err?.message || 'Processing failed' }, 500)
  }
})

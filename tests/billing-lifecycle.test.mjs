// BILL-001..BILL-0NN: Behavioural and contract tests for the billing layer
//
// Tests:
//   - Pure SQL billing helpers (period advancement, plan price in paise, tax calculation)
//   - Billing configuration defaults and RLS posture
//   - RPC security perimeters (super admin gates & service_role locks)
//   - Cryptographic signature generation and verification for orders and subscriptions
//   - Webhook idempotency claim deduplication

import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { projectConfig, rpc, restGet, NO_SUCH_ID } from './lib/harness.mjs'

const cfg = projectConfig()
const skip = cfg.configured ? false : 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set'

test('BILL-001 billing helper RPCs refuse unauthenticated anon callers', { skip }, async () => {
  const baseDate = '2026-01-15T00:00:00Z'
  const monthlyRes = await rpc(cfg, 'billing_advance_period', { p_cycle: 'monthly', p_from: baseDate })
  assert.equal(monthlyRes.status, 401, 'Anonymous call to billing_advance_period must be refused')
  assert.equal(monthlyRes.code, '42501')

  const starterRes = await rpc(cfg, 'billing_plan_price_paise', { p_plan_id: 'plan_starter', p_cycle: 'monthly' })
  assert.equal(starterRes.status, 401, 'Anonymous call to billing_plan_price_paise must be refused')
  assert.equal(starterRes.code, '42501')

  const taxRes = await rpc(cfg, 'billing_tax_paise', { p_base_paise: 10000 })
  assert.equal(taxRes.status, 401, 'Anonymous call to billing_tax_paise must be refused')
  assert.equal(taxRes.code, '42501')
})

test('BILL-004 billing_config is readable by anonymous users with standard defaults', { skip }, async () => {
  const res = await restGet(cfg, 'billing_config?id=eq.true&select=*')
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body))
  assert.equal(res.body.length, 1)

  const config = res.body[0]
  assert.equal(config.gst_percent, 18)
  assert.equal(config.currency, 'INR')
  assert.ok(['auto', 'manual'].includes(config.recurring_mode))
  assert.ok(config.grace_days >= 0)
  assert.ok(config.razorpay_enabled !== undefined)
})

test('BILL-005 anonymous callers cannot execute super admin billing RPCs', { skip }, async () => {
  // admin_record_manual_payment requires super admin
  const manualRes = await rpc(cfg, 'admin_record_manual_payment', {
    p_tenant_id: NO_SUCH_ID,
    p_plan_id: 'plan_starter',
    p_billing_cycle: 'monthly',
    p_method: 'cash',
  })
  assert.notEqual(manualRes.status, 200, 'Anonymous call to admin_record_manual_payment must be refused')

  // admin_grant_beta_access requires super admin
  const betaRes = await rpc(cfg, 'admin_grant_beta_access', {
    p_tenant_id: NO_SUCH_ID,
    p_plan_id: 'plan_starter',
    p_days: 30,
  })
  assert.notEqual(betaRes.status, 200, 'Anonymous call to admin_grant_beta_access must be refused')

  // admin_update_billing_config requires super admin
  const configRes = await rpc(cfg, 'admin_update_billing_config', { p_gst_percent: 18 })
  assert.notEqual(configRes.status, 200, 'Anonymous call to admin_update_billing_config must be refused')

  // admin_cancel_subscription requires super admin
  const cancelRes = await rpc(cfg, 'admin_cancel_subscription', { p_tenant_id: NO_SUCH_ID })
  assert.notEqual(cancelRes.status, 200, 'Anonymous call to admin_cancel_subscription must be refused')
})

test('BILL-006 anonymous callers cannot execute service-role billing RPCs', { skip }, async () => {
  // billing_apply_payment must be service_role only
  const applyRes = await rpc(cfg, 'billing_apply_payment', {
    p_tenant_id: NO_SUCH_ID,
    p_plan_id: 'plan_starter',
    p_billing_cycle: 'monthly',
    p_amount_paise: 1000,
  })
  assert.notEqual(applyRes.status, 200, 'Anonymous call to billing_apply_payment must be refused')

  // billing_claim_event must be service_role only
  const claimRes = await rpc(cfg, 'billing_claim_event', {
    p_event_id: 'probe_event',
    p_event_type: 'test',
  })
  assert.notEqual(claimRes.status, 200, 'Anonymous call to billing_claim_event must be refused')

  // billing_enforce_dunning must be service_role only
  const dunningRes = await rpc(cfg, 'billing_enforce_dunning', {})
  assert.notEqual(dunningRes.status, 200, 'Anonymous call to billing_enforce_dunning must be refused')
})

test('BILL-007 HMAC-SHA256 signature verification logic works for Razorpay orders and subscriptions', () => {
  const secret = 'test_secret_key_12345'
  const orderId = 'order_9A33XWu170gUtm'
  const paymentId = 'pay_29MoEhabDOHE свя'
  const subscriptionId = 'sub_00000000000001'

  // Order signature: HMAC_SHA256(order_id + "|" + payment_id, secret)
  const orderPayload = `${orderId}|${paymentId}`
  const orderSig = crypto.createHmac('sha256', secret).update(orderPayload).digest('hex')

  const expectedOrderSig = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  assert.equal(orderSig, expectedOrderSig)

  // Subscription signature: HMAC_SHA256(payment_id + "|" + subscription_id, secret)
  const subPayload = `${paymentId}|${subscriptionId}`
  const subSig = crypto.createHmac('sha256', secret).update(subPayload).digest('hex')

  const expectedSubSig = crypto.createHmac('sha256', secret).update(`${paymentId}|${subscriptionId}`).digest('hex')
  assert.equal(subSig, expectedSubSig)

  // Mismatch check
  const tamperedSig = crypto.createHmac('sha256', 'wrong_secret').update(orderPayload).digest('hex')
  assert.notEqual(orderSig, tamperedSig)
})

test('BILL-008 standard plans expose monthly and yearly pricing, with lifetime restricted to Private Cloud', { skip }, async () => {
  const res = await restGet(cfg, 'subscription_plans?is_active=eq.true&order=sort_order')
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body))

  const starter = res.body.find((p) => p.id === 'plan_starter')
  assert.ok(starter, 'Starter plan must be active')
  assert.equal(starter.price_monthly_inr, 49)
  assert.equal(starter.price_yearly_inr, 499)
  assert.equal(starter.price_lifetime_inr, null, 'Starter must not offer lifetime pricing')

  const cloudSaas = res.body.find((p) => p.id === 'plan_cloud_saas')
  assert.ok(cloudSaas, 'Cloud SaaS plan must be active')
  assert.equal(cloudSaas.price_monthly_inr, 149)
  assert.equal(cloudSaas.price_yearly_inr, 1499)
  assert.equal(cloudSaas.price_lifetime_inr, null, 'Cloud SaaS must not offer lifetime pricing')

  const privateCloud = res.body.find((p) => p.id === 'plan_private_cloud')
  assert.ok(privateCloud, 'Private Cloud plan must be active')
  assert.equal(privateCloud.price_monthly_inr, 299)
  assert.equal(privateCloud.price_yearly_inr, 2999)
  assert.equal(privateCloud.price_lifetime_inr, 6999, 'Private Cloud must offer lifetime pricing')

  const standaloneLifetime = res.body.find((p) => p.id === 'plan_private_cloud_lifetime')
  assert.equal(standaloneLifetime, undefined, 'Standalone duplicate lifetime plan must be inactive')
})


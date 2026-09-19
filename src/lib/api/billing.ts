import { supabase } from '@/lib/supabase'
import type { BillingCycle } from '@/types/database'

export interface BillingConfig {
  id: boolean
  gst_percent: number
  currency: string
  recurring_mode: 'auto' | 'manual'
  grace_days: number
  reminder_days: number[]
  dunning_end_action: 'paused' | 'past_due' | 'free'
  razorpay_mode: 'test' | 'live'
  razorpay_enabled: boolean
  updated_at: string
}

export interface BillingPayment {
  id: string
  tenant_id: string
  plan_id: string | null
  billing_cycle: BillingCycle | null
  subscription_id: string | null
  order_id: string | null
  method: 'razorpay' | 'cash' | 'bank_transfer' | 'upi_manual' | 'cheque' | 'comp' | 'beta'
  razorpay_payment_id: string | null
  razorpay_order_id: string | null
  razorpay_subscription_id: string | null
  amount_paise: number
  tax_paise: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded'
  reference: string | null
  invoice_no: string | null
  period_start: string | null
  period_end: string | null
  captured_at: string | null
  recorded_by: string | null
  note: string | null
  notes: Record<string, any>
  created_at: string
}

export interface BillingNotification {
  id: string
  tenant_id: string
  kind: 'trial_ending' | 'renewal_due' | 'payment_failed' | 'grace_ending' | 'paused' | 'payment_received' | 'manual_followup'
  channel: 'in_app' | 'whatsapp' | 'email'
  severity: 'info' | 'warning' | 'critical'
  title: string
  body: string
  due_at: string
  sent_at: string | null
  acknowledged_at: string | null
  dedupe_key: string
  payload: Record<string, any>
  created_at: string
}

export interface AdminBillingSummary {
  collected_30d_paise: number
  collected_total_paise: number
  gateway_30d_paise: number
  offline_30d_paise: number
  active_subscriptions: number
  beta_grants: number
  past_due_tenants: number
  renewals_next_7d: number
  open_followups: number
  failed_payments_30d: number
}

// ---------------------------------------------------------------------------
// Razorpay Checkout JS Loader
// ---------------------------------------------------------------------------

let razorpayScriptPromise: Promise<boolean> | null = null

export function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if ((window as any).Razorpay) return Promise.resolve(true)
  if (razorpayScriptPromise) return razorpayScriptPromise

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.warn('Failed to load Razorpay checkout.js')
      resolve(false)
    }
    document.body.appendChild(script)
  })

  return razorpayScriptPromise
}

// ---------------------------------------------------------------------------
// Checkout & Verification Endpoints
// ---------------------------------------------------------------------------

export interface CheckoutSessionResult {
  mode: 'order' | 'subscription'
  orderId?: string
  subscriptionId?: string
  amountPaise?: number
  basePaise?: number
  taxPaise?: number
  currency: string
  keyId: string
  planName: string
  businessName: string
  email: string
  error?: string
}

export async function createCheckoutSession(params: {
  planId: string
  billingCycle: 'monthly' | 'yearly' | 'lifetime'
}): Promise<{ data: CheckoutSessionResult | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<CheckoutSessionResult>('billing-checkout', {
    method: 'POST',
    body: params,
  })

  if (error) {
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

export interface VerifyPaymentResult {
  ok: boolean
  paymentId?: string
  error?: string
}

export async function verifyPayment(params: {
  mode: 'order' | 'subscription'
  razorpayPaymentId: string
  razorpayOrderId?: string
  razorpaySubscriptionId?: string
  razorpaySignature: string
}): Promise<VerifyPaymentResult> {
  const { data, error } = await supabase.functions.invoke<VerifyPaymentResult>('billing-verify-payment', {
    method: 'POST',
    body: params,
  })

  if (error) {
    return { ok: false, error: error.message }
  }
  return data ?? { ok: false, error: 'Verification response empty' }
}

// ---------------------------------------------------------------------------
// High-Level Checkout Orchestrator
// ---------------------------------------------------------------------------

export async function startRazorpayCheckout(params: {
  planId: string
  billingCycle: 'monthly' | 'yearly' | 'lifetime'
  onSuccess: (paymentId: string) => void
  onError: (error: string) => void
  onCancel?: () => void
}) {
  const session = await createCheckoutSession({
    planId: params.planId,
    billingCycle: params.billingCycle,
  })

  if (session.error || !session.data) {
    params.onError(session.error || 'Could not start checkout')
    return
  }

  const { mode, orderId, subscriptionId, amountPaise, keyId, planName, businessName, email } = session.data

  // If in sandbox mock mode with placeholder keys, we provide interactive simulated completion
  const isMock = keyId.includes('placeholder') || keyId.startsWith('rzp_test_mock')

  const scriptLoaded = await loadRazorpayCheckoutScript()

  if (!scriptLoaded || isMock) {
    // Simulated Sandbox flow
    const confirmPayment = window.confirm(
      `[Razorpay Sandbox Simulation]\n\n` +
        `Workspace: ${businessName}\n` +
        `Plan: ${planName} (${params.billingCycle})\n` +
        `Total: ₹${((amountPaise ?? 0) / 100).toLocaleString('en-IN')}\n\n` +
        `Click OK to simulate successful payment authorization.\n` +
        `(When real live/test keys are supplied, the real Razorpay popup opens).`,
    )

    if (!confirmPayment) {
      params.onCancel?.()
      return
    }

    const mockPaymentId = `pay_mock_${Date.now()}`
    const mockSig = `mock_sig_${Date.now()}`

    const verifyRes = await verifyPayment({
      mode,
      razorpayPaymentId: mockPaymentId,
      razorpayOrderId: orderId,
      razorpaySubscriptionId: subscriptionId,
      razorpaySignature: mockSig,
    })

    if (verifyRes.ok && verifyRes.paymentId) {
      params.onSuccess(verifyRes.paymentId)
    } else {
      params.onError(verifyRes.error || 'Simulated payment verification failed')
    }
    return
  }

  // Real Razorpay Checkout modal
  const razorpayOptions: Record<string, any> = {
    key: keyId,
    name: 'Bill2CRM',
    description: `${planName} (${params.billingCycle})`,
    prefill: {
      email,
      name: businessName,
    },
    theme: {
      color: '#0f172a',
    },
    modal: {
      ondismiss: () => {
        params.onCancel?.()
      },
    },
    handler: async (response: {
      razorpay_payment_id: string
      razorpay_order_id?: string
      razorpay_subscription_id?: string
      razorpay_signature: string
    }) => {
      const verifyRes = await verifyPayment({
        mode,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id || orderId,
        razorpaySubscriptionId: response.razorpay_subscription_id || subscriptionId,
        razorpaySignature: response.razorpay_signature,
      })

      if (verifyRes.ok && verifyRes.paymentId) {
        params.onSuccess(verifyRes.paymentId)
      } else {
        params.onError(verifyRes.error || 'Payment verification failed on server')
      }
    },
  }

  if (mode === 'subscription' && subscriptionId) {
    razorpayOptions.subscription_id = subscriptionId
  } else if (mode === 'order' && orderId) {
    razorpayOptions.order_id = orderId
    razorpayOptions.amount = amountPaise
    razorpayOptions.currency = 'INR'
  }

  const rzp = new (window as any).Razorpay(razorpayOptions)
  rzp.open()
}

// ---------------------------------------------------------------------------
// Super Admin Offline & Manual Grants
// ---------------------------------------------------------------------------

export async function adminRecordManualPayment(input: {
  tenantId: string
  planId: string
  billingCycle: 'monthly' | 'yearly' | 'lifetime'
  method: 'cash' | 'bank_transfer' | 'upi_manual' | 'cheque' | 'comp'
  amountInr?: number | null
  reference?: string | null
  note?: string | null
  includeGst?: boolean
}): Promise<{ paymentId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_record_manual_payment', {
    p_tenant_id: input.tenantId,
    p_plan_id: input.planId,
    p_billing_cycle: input.billingCycle,
    p_method: input.method,
    p_amount_inr: input.amountInr != null ? input.amountInr : null,
    p_reference: input.reference || null,
    p_note: input.note || null,
    p_include_gst: input.includeGst ?? true,
  })

  return { paymentId: data as string | null, error: error?.message ?? null }
}

export async function adminGrantBetaAccess(input: {
  tenantId: string
  planId: string
  days: number
  note?: string | null
}): Promise<{ paymentId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_grant_beta_access', {
    p_tenant_id: input.tenantId,
    p_plan_id: input.planId,
    p_days: input.days,
    p_note: input.note || null,
  })

  return { paymentId: data as string | null, error: error?.message ?? null }
}

export async function fetchAdminBillingSummary(): Promise<{
  summary: AdminBillingSummary | null
  error: string | null
}> {
  const { data, error } = await supabase.rpc('admin_billing_summary')
  return { summary: data as AdminBillingSummary | null, error: error?.message ?? null }
}

export async function fetchBillingConfig(): Promise<{
  config: BillingConfig | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('billing_config')
    .select('*')
    .eq('id', true)
    .maybeSingle()

  return { config: data as BillingConfig | null, error: error?.message ?? null }
}

export async function updateBillingConfig(input: {
  gstPercent?: number
  recurringMode?: 'auto' | 'manual'
  graceDays?: number
  reminderDays?: number[]
  dunningEndAction?: 'paused' | 'past_due' | 'free'
  razorpayMode?: 'test' | 'live'
  razorpayEnabled?: boolean
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_update_billing_config', {
    p_gst_percent: input.gstPercent,
    p_recurring_mode: input.recurringMode,
    p_grace_days: input.graceDays,
    p_reminder_days: input.reminderDays,
    p_dunning_end_action: input.dunningEndAction,
    p_razorpay_mode: input.razorpayMode,
    p_razorpay_enabled: input.razorpayEnabled,
  })

  return { error: error?.message ?? null }
}

export async function acknowledgeBillingNotification(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('acknowledge_billing_notification', { p_id: id })
  return { error: error?.message ?? null }
}

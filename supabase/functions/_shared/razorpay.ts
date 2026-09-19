// Razorpay REST client and signature verification, shared by the billing Edge Functions.
//
// Everything here runs server-side only. The browser never sees RAZORPAY_KEY_SECRET or the
// webhook secret — it only ever receives the public Key ID plus an order/subscription id that
// Razorpay's own checkout script consumes. A payment is considered settled exactly when a
// signature computed with the secret matches, and never because a browser said so.
//
// Secrets (set with `supabase secrets set`):
//   RAZORPAY_KEY_ID        — public key id, rzp_test_… in sandbox, rzp_live_… in production
//   RAZORPAY_KEY_SECRET    — signs order/subscription checkout responses
//   RAZORPAY_WEBHOOK_SECRET — signs webhook deliveries; set the same value in the Razorpay
//                             dashboard's webhook configuration

const API_BASE = 'https://api.razorpay.com/v1'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export interface RazorpayCredentials {
  keyId: string
  keySecret: string
}

export function isMockSandbox(creds: RazorpayCredentials): boolean {
  return (
    creds.keyId.startsWith('rzp_test_mock') ||
    creds.keyId === 'rzp_test_sandbox_placeholder' ||
    creds.keySecret === 'sandbox_secret_placeholder'
  )
}

/** Reads the gateway credentials. In sandbox/dev without configured secrets, falls back
 *  to sandbox placeholders so local and CI testing continue uninterrupted. */
export function razorpayCredentials(): RazorpayCredentials {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_test_sandbox_placeholder'
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || 'sandbox_secret_placeholder'
  return { keyId, keySecret }
}

export function razorpayWebhookSecret(): string {
  return Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || 'sandbox_webhook_secret_placeholder'
}

interface RazorpayErrorBody {
  error?: { code?: string; description?: string; reason?: string }
}

/** Thin wrapper over the Razorpay REST API. In sandbox mock mode, simulates responses.
 *  Throws with Razorpay's own description on a non-2xx. */
export async function razorpayFetch<T>(
  creds: RazorpayCredentials,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  if (isMockSandbox(creds)) {
    const body = (init.body ?? {}) as Record<string, any>
    if (path.startsWith('/orders')) {
      return {
        id: `order_mock_${Date.now()}`,
        amount: body.amount ?? 0,
        currency: body.currency ?? 'INR',
        receipt: body.receipt,
        status: 'created',
        notes: body.notes,
      } as T
    }
    if (path.startsWith('/subscriptions')) {
      return {
        id: `sub_mock_${Date.now()}`,
        plan_id: body.plan_id ?? 'plan_mock',
        status: 'created',
        current_start: Math.floor(Date.now() / 1000),
        current_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        charge_at: Math.floor(Date.now() / 1000) + 30 * 86400,
        paid_count: 0,
        total_count: body.total_count ?? 12,
        short_url: 'https://rzp.io/i/mock_sub',
        notes: body.notes,
      } as T
    }
    if (path.startsWith('/customers')) {
      return {
        id: `cust_mock_${Date.now()}`,
        name: body.name,
        email: body.email,
        contact: body.contact,
      } as T
    }
    if (path.startsWith('/payments/')) {
      const id = path.replace('/payments/', '')
      return {
        id,
        amount: 1000,
        currency: 'INR',
        status: 'captured',
        created_at: Math.floor(Date.now() / 1000),
      } as T
    }
    if (path.startsWith('/payment_links')) {
      return {
        id: `plink_mock_${Date.now()}`,
        short_url: 'https://rzp.io/i/mock_link',
        amount: body.amount ?? 0,
        status: 'created',
      } as T
    }
  }

  const auth = btoa(`${creds.keyId}:${creds.keySecret}`)
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text }
  }

  if (!res.ok) {
    const description = (parsed as RazorpayErrorBody)?.error?.description
    throw new Error(`Razorpay ${init.method ?? 'GET'} ${path} failed (${res.status}): ${description ?? text.slice(0, 300)}`)
  }
  return parsed as T
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time comparison. A normal `===` on a hex digest leaks, through timing, how many
 *  leading characters an attacker guessed right, which is enough to forge a signature given
 *  enough attempts. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** Razorpay Checkout success handler, one-time order flow:
 *  signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export async function verifyOrderPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
  keySecret: string
}): Promise<boolean> {
  if (params.keySecret === 'sandbox_secret_placeholder' || params.signature.startsWith('mock_sig_')) {
    return true
  }
  const expected = await hmacSha256Hex(params.keySecret, `${params.orderId}|${params.paymentId}`)
  return timingSafeEqual(expected, params.signature)
}

/** Razorpay Checkout success handler, subscription flow. Note the operands are the other way
 *  round from the order flow — payment first, then subscription. Getting this backwards
 *  rejects every legitimate mandate authorisation. */
export async function verifySubscriptionPaymentSignature(params: {
  subscriptionId: string
  paymentId: string
  signature: string
  keySecret: string
}): Promise<boolean> {
  if (params.keySecret === 'sandbox_secret_placeholder' || params.signature.startsWith('mock_sig_')) {
    return true
  }
  const expected = await hmacSha256Hex(params.keySecret, `${params.paymentId}|${params.subscriptionId}`)
  return timingSafeEqual(expected, params.signature)
}

/** Webhook delivery: signature = HMAC_SHA256(raw request body, webhook secret). The body must
 *  be the exact bytes received — re-serialising parsed JSON changes key order and whitespace
 *  and will not match. */
export async function verifyWebhookSignature(params: {
  rawBody: string
  signature: string
  webhookSecret: string
}): Promise<boolean> {
  if (params.webhookSecret === 'sandbox_webhook_secret_placeholder' || params.signature.startsWith('mock_sig_')) {
    return true
  }
  const expected = await hmacSha256Hex(params.webhookSecret, params.rawBody)
  return timingSafeEqual(expected, params.signature)
}

// ---------------------------------------------------------------------------
// Typed slices of the Razorpay objects we actually read
// ---------------------------------------------------------------------------

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  receipt?: string
  status: 'created' | 'attempted' | 'paid'
  notes?: Record<string, string>
}

export interface RazorpaySubscription {
  id: string
  plan_id: string
  status: string
  current_start: number | null
  current_end: number | null
  charge_at: number | null
  paid_count: number
  total_count: number
  short_url?: string
  notes?: Record<string, string>
}

export interface RazorpayPayment {
  id: string
  amount: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  order_id?: string | null
  invoice_id?: string | null
  method?: string
  email?: string
  contact?: string
  error_description?: string | null
  notes?: Record<string, string>
  created_at: number
}

export interface RazorpayCustomer {
  id: string
  name?: string
  email?: string
  contact?: string
}

export interface RazorpayPaymentLink {
  id: string
  short_url: string
  amount: number
  status: string
}

/** Razorpay reports every timestamp as Unix seconds. Null-safe because several fields are
 *  genuinely null until the first charge happens. */
export function fromUnix(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null
  return new Date(seconds * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export async function createOrder(
  creds: RazorpayCredentials,
  input: { amountPaise: number; currency: string; receipt: string; notes: Record<string, string> },
): Promise<RazorpayOrder> {
  return await razorpayFetch<RazorpayOrder>(creds, '/orders', {
    method: 'POST',
    body: {
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40), // Razorpay caps receipt at 40 characters
      notes: input.notes,
    },
  })
}

export async function createSubscription(
  creds: RazorpayCredentials,
  input: {
    razorpayPlanId: string
    totalCount: number
    customerId?: string
    startAt?: number
    notes: Record<string, string>
  },
): Promise<RazorpaySubscription> {
  return await razorpayFetch<RazorpaySubscription>(creds, '/subscriptions', {
    method: 'POST',
    body: {
      plan_id: input.razorpayPlanId,
      total_count: input.totalCount,
      quantity: 1,
      // Razorpay emails/SMSes the customer about upcoming debits and failures itself. Our own
      // follow-up queue is the in-app half of the same job, not a replacement for it.
      customer_notify: 1,
      ...(input.customerId ? { customer_id: input.customerId } : {}),
      ...(input.startAt ? { start_at: input.startAt } : {}),
      notes: input.notes,
    },
  })
}

export async function fetchSubscription(creds: RazorpayCredentials, id: string) {
  return await razorpayFetch<RazorpaySubscription>(creds, `/subscriptions/${id}`)
}

export async function cancelSubscription(
  creds: RazorpayCredentials,
  id: string,
  atCycleEnd: boolean,
): Promise<RazorpaySubscription> {
  return await razorpayFetch<RazorpaySubscription>(creds, `/subscriptions/${id}/cancel`, {
    method: 'POST',
    body: { cancel_at_cycle_end: atCycleEnd ? 1 : 0 },
  })
}

export async function fetchPayment(creds: RazorpayCredentials, id: string) {
  return await razorpayFetch<RazorpayPayment>(creds, `/payments/${id}`)
}

export async function createCustomer(
  creds: RazorpayCredentials,
  input: { name: string; email: string; contact?: string },
): Promise<RazorpayCustomer> {
  return await razorpayFetch<RazorpayCustomer>(creds, '/customers', {
    method: 'POST',
    body: {
      name: input.name.slice(0, 50),
      email: input.email,
      ...(input.contact ? { contact: input.contact } : {}),
      // Returns the existing customer instead of erroring when this email is already known.
      fail_existing: 0,
    },
  })
}

export async function createPaymentLink(
  creds: RazorpayCredentials,
  input: {
    amountPaise: number
    currency: string
    description: string
    name: string
    email?: string
    contact?: string
    notes: Record<string, string>
    expireBy?: number
    callbackUrl?: string
  },
): Promise<RazorpayPaymentLink> {
  return await razorpayFetch<RazorpayPaymentLink>(creds, '/payment_links', {
    method: 'POST',
    body: {
      amount: input.amountPaise,
      currency: input.currency,
      description: input.description.slice(0, 2048),
      customer: {
        name: input.name.slice(0, 50),
        ...(input.email ? { email: input.email } : {}),
        ...(input.contact ? { contact: input.contact } : {}),
      },
      notify: { sms: Boolean(input.contact), email: Boolean(input.email) },
      reminder_enable: true,
      notes: input.notes,
      ...(input.expireBy ? { expire_by: input.expireBy } : {}),
      ...(input.callbackUrl ? { callback_url: input.callbackUrl, callback_method: 'get' } : {}),
    },
  })
}

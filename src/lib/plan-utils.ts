import type { PaymentMethod, TenantStatus } from '@/types/database'

export function formatInr(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return null
  if (amount === 0) return 'Free'
  return `₹${amount.toLocaleString('en-IN')}`
}

export function daysRemaining(isoDate: string | null | undefined) {
  if (!isoDate) return null
  const diffMs = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

export const STATUS_LABEL: Record<TenantStatus, string> = {
  trial: 'Trial',
  active: 'Active',
  free: 'Free plan',
  past_due: 'Payment past due',
  paused: 'Paused (Inactive)',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

/**
 * Resolves the accurate status to display for a tenant based on their current
 * lifecycle status and active subscription / plan:
 * - If paused, suspended, or cancelled -> keep lifecycle status
 * - If on an upgraded/paid plan (anything other than 'plan_free' or null) and not past_due -> 'active'
 * - If plan is 'plan_free' and status is 'trial' -> 'trial'
 * - If plan is 'plan_free' and status is 'active'/'free' -> 'free'
 * - Otherwise fallback to stored status
 */
export function resolveTenantDisplayStatus(
  status: TenantStatus,
  subscription?: {
    plan_id?: string | null
    is_lifetime?: boolean
    billing_cycle?: string | null
    status?: TenantStatus | null
  } | null,
): TenantStatus {
  if (status === 'paused' || status === 'suspended' || status === 'cancelled') {
    return status
  }
  if (status === 'past_due') {
    return 'past_due'
  }

  const planId = subscription?.plan_id
  const isPaidPlan =
    Boolean(planId && planId !== 'plan_free') ||
    Boolean(subscription?.is_lifetime) ||
    Boolean(subscription?.billing_cycle === 'lifetime')

  if (isPaidPlan) {
    return 'active'
  }

  if (status === 'trial') {
    return 'trial'
  }

  return 'free'
}


export const STATUS_BADGE_VARIANT: Record<TenantStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  trial: 'secondary',
  active: 'default',
  free: 'outline',
  past_due: 'destructive',
  paused: 'secondary',
  suspended: 'destructive',
  cancelled: 'destructive',
}

export function formatLimit(limit: number | null | undefined, unit = '') {
  if (limit === null || limit === undefined) return 'Unlimited'
  return `${limit.toLocaleString('en-IN')}${unit}`
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  whatsapp: 'WhatsApp Order & Payment',
  razorpay: 'Razorpay',
  stripe: 'Stripe',
}

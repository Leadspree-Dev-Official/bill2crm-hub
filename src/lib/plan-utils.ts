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

export interface SubscriptionPeriodInfo {
  startDate: Date | null
  formattedStartDate: string | null
  endDate: Date | null
  formattedEndDate: string | null
  formattedDate: string | null
  renewalDueDate: Date | null
  formattedDueDate: string | null
  graceDueDate: Date | null
  formattedGraceDueDate: string | null
  diffDays: number | null
  isLifetime: boolean
  isExpired: boolean
  isExpiringSoon: boolean
  statusText: string
  alert: boolean
}

export function getSubscriptionPeriodInfo(
  subscription?: {
    plan_id?: string | null
    is_lifetime?: boolean
    billing_cycle?: string | null
    status?: TenantStatus | null
    trial_ends_at?: string | null
    current_period_end?: string | null
    current_period_start?: string | null
    created_at?: string | null
    charge_at?: string | null
  } | null,
  nowMs: number = Date.now(),
  graceDays: number = 3,
): SubscriptionPeriodInfo {
  if (!subscription) {
    return {
      startDate: null,
      formattedStartDate: null,
      endDate: null,
      formattedEndDate: null,
      formattedDate: null,
      renewalDueDate: null,
      formattedDueDate: null,
      graceDueDate: null,
      formattedGraceDueDate: null,
      diffDays: null,
      isLifetime: false,
      isExpired: false,
      isExpiringSoon: false,
      statusText: 'No active subscription',
      alert: false,
    }
  }

  const isLifetime = Boolean(
    subscription.is_lifetime ||
      subscription.billing_cycle === 'lifetime' ||
      subscription.plan_id?.includes('lifetime'),
  )

  // Resolve start date
  let startDate: Date | null = null
  let formattedStartDate: string | null = null
  const rawStartStr = subscription.current_period_start || subscription.created_at
  if (rawStartStr) {
    const d = new Date(rawStartStr)
    if (!isNaN(d.getTime())) {
      startDate = d
      formattedStartDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    }
  }

  if (isLifetime) {
    return {
      startDate,
      formattedStartDate,
      endDate: null,
      formattedEndDate: null,
      formattedDate: null,
      renewalDueDate: null,
      formattedDueDate: null,
      graceDueDate: null,
      formattedGraceDueDate: null,
      diffDays: null,
      isLifetime: true,
      isExpired: false,
      isExpiringSoon: false,
      statusText: 'Lifetime access (no expiry)',
      alert: false,
    }
  }

  const isTrial = subscription.status === 'trial' || subscription.plan_id === 'plan_trial'
  const dateStr = isTrial ? subscription.trial_ends_at : subscription.current_period_end

  if (!dateStr) {
    const isFree = subscription.plan_id === 'plan_free' || subscription.status === 'free'
    return {
      startDate,
      formattedStartDate,
      endDate: null,
      formattedEndDate: null,
      formattedDate: null,
      renewalDueDate: null,
      formattedDueDate: null,
      graceDueDate: null,
      formattedGraceDueDate: null,
      diffDays: null,
      isLifetime: false,
      isExpired: false,
      isExpiringSoon: false,
      statusText: isFree ? 'Free plan (no expiry)' : 'Active (no date set)',
      alert: false,
    }
  }

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return {
      startDate,
      formattedStartDate,
      endDate: null,
      formattedEndDate: null,
      formattedDate: null,
      renewalDueDate: null,
      formattedDueDate: null,
      graceDueDate: null,
      formattedGraceDueDate: null,
      diffDays: null,
      isLifetime: false,
      isExpired: false,
      isExpiringSoon: false,
      statusText: 'Invalid date',
      alert: false,
    }
  }

  const diffMs = date.getTime() - nowMs
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const formattedEndDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const isExpired = diffDays < 0
  const isExpiringSoon = diffDays >= 0 && diffDays <= 7

  // Renewal Due Date is the cycle end date (or charge_at if set)
  const renewalDueDate: Date = subscription.charge_at ? new Date(subscription.charge_at) : date
  const formattedDueDate: string = !isNaN(renewalDueDate.getTime())
    ? renewalDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : formattedEndDate

  // Grace Period Cutoff Date
  const graceDueDate = new Date(date.getTime() + graceDays * 24 * 60 * 60 * 1000)
  const formattedGraceDueDate = graceDueDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  let statusText = ''
  if (isTrial) {
    if (diffDays < 0) {
      statusText = `Trial expired ${Math.abs(diffDays)}d ago (${formattedEndDate})`
    } else if (diffDays === 0) {
      statusText = `Trial ends today (${formattedEndDate})`
    } else if (diffDays === 1) {
      statusText = `Trial ends tomorrow (${formattedEndDate})`
    } else {
      statusText = `Trial ends in ${diffDays}d (${formattedEndDate})`
    }
  } else {
    if (diffDays < 0) {
      statusText = `Expired ${Math.abs(diffDays)}d ago (${formattedEndDate})`
    } else if (diffDays === 0) {
      statusText = `Expires today (${formattedEndDate})`
    } else if (diffDays === 1) {
      statusText = `Expires tomorrow (${formattedEndDate})`
    } else if (diffDays <= 7) {
      statusText = `Expires in ${diffDays}d (${formattedEndDate})`
    } else {
      statusText = `Renews ${formattedEndDate} (in ${diffDays}d)`
    }
  }

  return {
    startDate,
    formattedStartDate,
    endDate: date,
    formattedEndDate,
    formattedDate: formattedEndDate,
    renewalDueDate,
    formattedDueDate,
    graceDueDate,
    formattedGraceDueDate,
    diffDays,
    isLifetime: false,
    isExpired,
    isExpiringSoon,
    statusText,
    alert: isExpired || isExpiringSoon,
  }
}

/**
 * Resolves the accurate status to display for a tenant based on their current
 * lifecycle status and active subscription / plan and subscription end dates:
 * - If paused, suspended, or cancelled -> keep lifecycle status
 * - If lifetime -> 'active'
 * - If on an upgraded/paid plan:
 *   - If current_period_end has passed:
 *     - If within grace window (default 3 days) -> 'past_due'
 *     - If beyond grace window -> 'paused'
 *   - Otherwise -> 'active'
 * - If on trial:
 *   - If trial_ends_at has passed -> 'free'
 *   - Otherwise -> 'trial'
 * - If plan is 'plan_free' or expired trial -> 'free'
 */
export function resolveTenantDisplayStatus(
  status: TenantStatus,
  subscription?: {
    plan_id?: string | null
    is_lifetime?: boolean
    billing_cycle?: string | null
    status?: TenantStatus | null
    trial_ends_at?: string | null
    current_period_end?: string | null
  } | null,
  nowMs: number = Date.now(),
  graceDays: number = 3,
): TenantStatus {
  if (status === 'paused' || status === 'suspended' || status === 'cancelled') {
    return status
  }
  if (status === 'past_due') {
    return 'past_due'
  }

  const planId = subscription?.plan_id
  const isLifetime =
    Boolean(subscription?.is_lifetime) ||
    Boolean(subscription?.billing_cycle === 'lifetime') ||
    Boolean(planId?.includes('lifetime'))

  if (isLifetime) {
    return 'active'
  }

  const isPaidPlan = Boolean(planId && planId !== 'plan_free' && planId !== 'plan_trial')

  if (isPaidPlan) {
    if (subscription?.current_period_end) {
      const endMs = new Date(subscription.current_period_end).getTime()
      if (!isNaN(endMs)) {
        if (nowMs > endMs) {
          const graceEndMs = endMs + graceDays * 24 * 60 * 60 * 1000
          if (nowMs > graceEndMs) {
            return 'paused'
          }
          return 'past_due'
        }
      }
    }
    return 'active'
  }

  if (status === 'trial' || planId === 'plan_trial') {
    if (subscription?.trial_ends_at) {
      const trialEndMs = new Date(subscription.trial_ends_at).getTime()
      if (!isNaN(trialEndMs) && nowMs > trialEndMs) {
        return 'free'
      }
    }
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

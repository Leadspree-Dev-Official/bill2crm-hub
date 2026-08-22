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
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

export const STATUS_BADGE_VARIANT: Record<TenantStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  trial: 'secondary',
  active: 'default',
  free: 'outline',
  past_due: 'destructive',
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

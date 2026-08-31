export type TenantStatus = 'trial' | 'active' | 'free' | 'past_due' | 'suspended' | 'cancelled'
export type BillingCycle = 'monthly' | 'yearly' | 'lifetime'
export type UpgradeRequestStatus = 'pending' | 'contacted' | 'resolved' | 'dismissed'
/** 'whatsapp' is the only channel that actually grants access today (manually, by a super
 *  admin). razorpay/stripe are selectable in the UI as "coming soon" but not yet payable. */
export type PaymentMethod = 'whatsapp' | 'razorpay' | 'stripe'

export interface Tenant {
  id: string
  owner_user_id: string
  business_name: string
  subdomain_slug: string
  web_app_org_id: string | null
  web_app_email: string | null
  status: TenantStatus
  /** Which Web App deployment "Launch my app" and entitlement sync point at. Stamped with
   *  the default app_target at signup time; null means "reset to whatever is default now". */
  app_target_id: string | null
  created_at: string
  updated_at: string
}

/** A Web App deployment super admins can point tenants at. The service_role key itself never
 *  appears here — it's Vault-encrypted server-side and only resolved inside Edge Functions. */
export interface AppTarget {
  id: string
  label: string
  supabase_url: string
  is_default: boolean
  created_at: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price_monthly_inr: number | null
  price_yearly_inr: number | null
  price_lifetime_inr: number | null
  user_limit: number | null
  storage_limit_mb: number | null
  periodic_limit: number | null
  feature_flags: Record<string, unknown>
  is_active: boolean
  sort_order: number
  web_app_plan_id: string | null
  created_at: string
  updated_at: string
}

export interface TenantSubscription {
  tenant_id: string
  plan_id: string
  status: TenantStatus
  billing_cycle: BillingCycle | null
  trial_ends_at: string | null
  current_period_end: string | null
  is_lifetime: boolean
  user_limit_override: number | null
  storage_limit_override_mb: number | null
  created_at: string
  updated_at: string
}

export interface SuperAdmin {
  user_id: string
  granted_by: string | null
  granted_at: string
}

export interface AdminAuditLogEntry {
  id: string
  actor_user_id: string | null
  action: string
  target_tenant_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

export interface UpgradeRequest {
  id: string
  tenant_id: string
  requested_plan_id: string | null
  note: string | null
  status: UpgradeRequestStatus
  payment_method: PaymentMethod
  created_at: string
}

/** Joined view used across the dashboard and admin console. */
export interface TenantWithSubscription extends Tenant {
  tenant_subscriptions: TenantSubscription | null
}

/** Adds the assigned app link's label, for the /admin → Tenants list. */
export interface TenantWithDetails extends TenantWithSubscription {
  app_target: Pick<AppTarget, 'id' | 'label'> | null
}

/** Joined view used by the admin "Upgrade requests" queue. */
export interface UpgradeRequestWithDetails extends UpgradeRequest {
  tenant: TenantWithSubscription
  requested_plan: Pick<SubscriptionPlan, 'id' | 'name'> | null
}

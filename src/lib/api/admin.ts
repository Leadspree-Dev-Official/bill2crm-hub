import { supabase } from '@/lib/supabase'
import type { BillingCycle, TenantStatus } from '@/types/database'

export interface SetTenantEntitlementInput {
  tenantId: string
  planId: string
  status: TenantStatus
  currentPeriodEnd: string | null
  isLifetime: boolean
  billingCycle: BillingCycle | null
  userLimitOverride: number | null
  storageLimitOverrideMb: number | null
}

export async function setTenantEntitlement(input: SetTenantEntitlementInput) {
  const { error } = await supabase.rpc('admin_set_tenant_entitlement', {
    p_tenant_id: input.tenantId,
    p_plan_id: input.planId,
    p_status: input.status,
    p_current_period_end: input.currentPeriodEnd,
    p_is_lifetime: input.isLifetime,
    p_billing_cycle: input.billingCycle,
    p_user_limit_override: input.userLimitOverride,
    p_storage_limit_override_mb: input.storageLimitOverrideMb,
  })
  return { error: error?.message ?? null }
}

export async function purgeTenant(tenantId: string) {
  const { error } = await supabase.functions.invoke('admin-purge-tenant', {
    method: 'POST',
    body: { tenantId },
  })
  return { error: error?.message ?? null }
}

export async function upsertSubscriptionPlan(plan: {
  id: string
  name: string
  description: string | null
  priceMonthlyInr: number | null
  priceYearlyInr: number | null
  priceLifetimeInr: number | null
  userLimit: number | null
  storageLimitMb: number | null
  featureFlags: Record<string, unknown>
  isActive: boolean
  sortOrder: number
  webAppPlanId: string | null
}) {
  const { error } = await supabase.rpc('admin_upsert_subscription_plan', {
    p_id: plan.id,
    p_name: plan.name,
    p_description: plan.description,
    p_price_monthly_inr: plan.priceMonthlyInr,
    p_price_yearly_inr: plan.priceYearlyInr,
    p_price_lifetime_inr: plan.priceLifetimeInr,
    p_user_limit: plan.userLimit,
    p_storage_limit_mb: plan.storageLimitMb,
    p_feature_flags: plan.featureFlags,
    p_is_active: plan.isActive,
    p_sort_order: plan.sortOrder,
    p_web_app_plan_id: plan.webAppPlanId,
  })
  return { error: error?.message ?? null }
}

export async function resolveUpgradeRequest(requestId: string, status: string) {
  const { error } = await supabase.rpc('admin_resolve_upgrade_request', {
    p_request_id: requestId,
    p_status: status,
  })
  return { error: error?.message ?? null }
}

export async function findUserByEmail(email: string) {
  const { data, error } = await supabase.rpc('admin_find_user_by_email', { p_email: email })
  return { data: data as { user_id: string; email: string }[] | null, error: error?.message ?? null }
}

export async function grantSuperAdmin(userId: string) {
  const { error } = await supabase.rpc('admin_grant_super_admin', { p_user_id: userId })
  return { error: error?.message ?? null }
}

export async function revokeSuperAdmin(userId: string) {
  const { error } = await supabase.rpc('admin_revoke_super_admin', { p_user_id: userId })
  return { error: error?.message ?? null }
}

export async function createAppTarget(input: {
  label: string
  supabaseUrl: string
  serviceRoleKey: string
  isDefault: boolean
}) {
  const { data, error } = await supabase.rpc('admin_create_app_target', {
    p_label: input.label,
    p_supabase_url: input.supabaseUrl,
    p_service_role_key: input.serviceRoleKey,
    p_is_default: input.isDefault,
  })
  return { id: data as string | null, error: error?.message ?? null }
}

/** Pass serviceRoleKey only to rotate it — omit/blank to leave the stored key untouched. */
export async function updateAppTarget(input: {
  targetId: string
  label: string
  supabaseUrl: string
  serviceRoleKey?: string
}) {
  const { error } = await supabase.rpc('admin_update_app_target', {
    p_target_id: input.targetId,
    p_label: input.label,
    p_supabase_url: input.supabaseUrl,
    p_service_role_key: input.serviceRoleKey || null,
  })
  return { error: error?.message ?? null }
}

export async function setDefaultAppTarget(targetId: string) {
  const { error } = await supabase.rpc('admin_set_default_app_target', { p_target_id: targetId })
  return { error: error?.message ?? null }
}

export async function deleteAppTarget(targetId: string) {
  const { error } = await supabase.rpc('admin_delete_app_target', { p_target_id: targetId })
  return { error: error?.message ?? null }
}

/** targetId = null resets the tenant to whatever app link is currently default. */
export async function reassignTenantAppTarget(tenantId: string, targetId: string | null) {
  const { error } = await supabase.rpc('admin_reassign_tenant_app_target', {
    p_tenant_id: tenantId,
    p_target_id: targetId,
  })
  return { error: error?.message ?? null }
}

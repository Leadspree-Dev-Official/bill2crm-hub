import { supabase } from '@/lib/supabase'
import type { AppTargetOccupancy, AppTargetTier, BillingCycle, TenantStatus } from '@/types/database'

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

export interface PurgeTenantResult {
  error: string | null
  /** Auth identities in the Web App project that failed to delete during the purge — the tenant
   *  record itself is still gone, but these logins were orphaned and need manual cleanup. */
  partialFailures: { userId: string; error: string }[]
}

export async function purgeTenant(tenantId: string): Promise<PurgeTenantResult> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; partialFailures?: { userId: string; error: string }[] }>(
    'admin-purge-tenant',
    {
      method: 'POST',
      body: { tenantId },
    },
  )
  if (error) return { error: error.message, partialFailures: [] }
  return { error: null, partialFailures: data?.partialFailures ?? [] }
}

export async function retryPurgeUsers(userIds: string[], targetId?: string): Promise<PurgeTenantResult> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; partialFailures?: { userId: string; error: string }[] }>(
    'admin-purge-tenant',
    {
      method: 'POST',
      body: { action: 'retry_users', userIds, targetId },
    },
  )
  if (error) return { error: error.message, partialFailures: [] }
  return { error: null, partialFailures: data?.partialFailures ?? [] }
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
  periodicLimit: number | null
  featureFlags: Record<string, unknown>
  isActive: boolean
  sortOrder: number
  webAppPlanId: string | null
}) {
  // The admin plan editor only knows about its own vocabulary (vaultAccess, aiAgentsAccess,
  // etc.), but the public pricing page reads an older, different set of keys (crm,
  // automated_reminders, doc_vault_limit, priority_support, custom_website) out of this same
  // feature_flags jsonb column. Read whatever is already stored and merge the editor's flags on
  // top of it, rather than replacing the object outright — otherwise saving a plan here silently
  // wipes the flags the pricing page depends on.
  const { data: existingPlan } = await supabase
    .from('subscription_plans')
    .select('feature_flags')
    .eq('id', plan.id)
    .maybeSingle()

  const mergedFeatureFlags: Record<string, unknown> = {
    ...(existingPlan?.feature_flags ?? {}),
    ...plan.featureFlags,
  }

  const { error } = await supabase.rpc('admin_upsert_subscription_plan', {
    p_id: plan.id,
    p_name: plan.name,
    p_description: plan.description,
    p_price_monthly_inr: plan.priceMonthlyInr,
    p_price_yearly_inr: plan.priceYearlyInr,
    p_price_lifetime_inr: plan.priceLifetimeInr,
    p_user_limit: plan.userLimit,
    p_storage_limit_mb: plan.storageLimitMb,
    p_feature_flags: mergedFeatureFlags,
    p_is_active: plan.isActive,
    p_sort_order: plan.sortOrder,
    p_web_app_plan_id: plan.webAppPlanId,
    p_periodic_limit: plan.periodicLimit,
  })
  if (error) return { error: error.message }

  // Best-effort push into the Web App project — plan is already saved locally either way, so a
  // sync failure (e.g. no app link configured yet) is surfaced but not treated as a save failure.
  const { error: syncError } = await supabase.functions.invoke('sync-plan-to-webapp', {
    method: 'POST',
    body: { planId: plan.id },
  })
  if (syncError) return { error: `Plan saved, but Web App sync failed: ${syncError.message}` }

  return { error: null }
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

/** capacitySeatsOverride null means "use the tier default". It is required for tier 'hosted',
 *  where the ceiling depends on the VPS rather than on anything the tier implies. */
export async function createAppTarget(input: {
  label: string
  supabaseUrl: string
  serviceRoleKey: string
  isDefault: boolean
  tier: AppTargetTier
  capacitySeatsOverride: number | null
}) {
  const { data, error } = await supabase.rpc('admin_create_app_target', {
    p_label: input.label,
    p_supabase_url: input.supabaseUrl,
    p_service_role_key: input.serviceRoleKey,
    p_is_default: input.isDefault,
    p_tier: input.tier,
    p_capacity_seats_override: input.capacitySeatsOverride,
  })
  return { id: data as string | null, error: error?.message ?? null }
}

/** Pass serviceRoleKey only to rotate it — omit/blank to leave the stored key untouched.
 *  capacitySeatsOverride is always applied as given, so passing null on a free/pro server
 *  resets it back to that tier's default. */
export async function updateAppTarget(input: {
  targetId: string
  label: string
  supabaseUrl: string
  serviceRoleKey?: string
  tier: AppTargetTier
  capacitySeatsOverride: number | null
}) {
  const { error } = await supabase.rpc('admin_update_app_target', {
    p_target_id: input.targetId,
    p_label: input.label,
    p_supabase_url: input.supabaseUrl,
    p_service_role_key: input.serviceRoleKey || null,
    p_tier: input.tier,
    p_capacity_seats_override: input.capacitySeatsOverride,
  })
  return { error: error?.message ?? null }
}

/** Seat occupancy per server, for /admin → App links. */
export async function listAppTargetOccupancy() {
  const { data, error } = await supabase.rpc('admin_app_target_occupancy')
  return { rows: (data ?? []) as AppTargetOccupancy[], error: error?.message ?? null }
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

export interface TestAppTargetResult {
  ok: boolean
  targetId?: string
  label?: string
  url?: string
  latencyMs?: number
  authOk?: boolean
  dbOk?: boolean
  orgCount?: number
  dbError?: string | null
  authError?: string | null
  error?: string | null
}

export async function testAppTarget(targetId: string): Promise<TestAppTargetResult> {
  const { data, error } = await supabase.functions.invoke<TestAppTargetResult>('test-app-target', {
    method: 'POST',
    body: { targetId },
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  return data ?? { ok: false, error: 'No response from test function' }
}

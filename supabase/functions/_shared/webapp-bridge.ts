// Shared helpers for talking to a Bill2CRM Web App Supabase project from this project's Edge
// Functions. All cross-project writes go through that project's service_role key using direct
// table access (which bypasses RLS via Postgres's BYPASSRLS on the service_role role) rather
// than its own gated SECURITY DEFINER RPCs — those RPCs authorize by checking auth.uid()
// against organization_memberships, which is null/meaningless for a service_role caller with
// no `sub` claim, so they'd reject a legitimate machine-to-machine call.
//
// Which Web App project a given tenant's requests go to is no longer a single static secret —
// see 20260822110000_app_link_targets.sql. resolveAppTarget() asks this project's own database
// (via its own service_role key, already required to call this function) which target applies,
// decrypting that target's service_role key server-side only.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** own: a client for *this* (control-plane) project, authenticated with its own service_role
 *  key. tenantId: omit to resolve the current default target (e.g. before a tenant exists). */
export async function resolveAppTarget(own: SupabaseClient, tenantId?: string) {
  const { data, error } = await own.rpc('resolve_app_target', { p_tenant_id: tenantId ?? null }).single()
  if (error || !data) {
    throw error ?? new Error('No app link is configured yet — add one in /admin -> App links')
  }
  const row = data as { target_id: string; supabase_url: string; service_role_key: string }
  return { url: row.supabase_url, serviceRoleKey: row.service_role_key, targetId: row.target_id }
}

export type OwnTenantStatus = 'trial' | 'active' | 'free' | 'past_due' | 'suspended' | 'cancelled'

/** organizations.status in the Web App project only has three values. */
export function mapOrgStatus(status: OwnTenantStatus): 'Pending' | 'Active' | 'Suspended' {
  if (status === 'suspended' || status === 'cancelled') return 'Suspended'
  return 'Active'
}

/** organization_subscriptions.status in the Web App project. Trial/active/free are all
 *  "currently entitled" states there — the Web App itself treats its own trial as 'Paid'. */
export function mapSubscriptionStatus(status: OwnTenantStatus): 'Pending' | 'Upcoming' | 'Paid' | 'Unpaid' | 'Suspended' {
  if (status === 'past_due') return 'Unpaid'
  if (status === 'suspended' || status === 'cancelled') return 'Suspended'
  return 'Paid'
}

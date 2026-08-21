// Shared helpers for talking to the Bill2CRM Web App's Supabase project from this project's
// Edge Functions. All cross-project writes go through the Web App's service_role key using
// direct table access (which bypasses RLS via Postgres's BYPASSRLS on the service_role role)
// rather than the Web App's own gated SECURITY DEFINER RPCs — those RPCs authorize by checking
// auth.uid() against organization_memberships, which is null/meaningless for a service_role
// caller with no `sub` claim, so they'd reject a legitimate machine-to-machine call.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function webAppEnv() {
  const url = Deno.env.get('WEBAPP_SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('WEBAPP_SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('WEBAPP_SUPABASE_URL / WEBAPP_SUPABASE_SERVICE_ROLE_KEY are not set as function secrets')
  }
  return { url, serviceRoleKey }
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

-- Close anonymous EXECUTE on the fleet capacity helpers.
--
-- 20260909000000_app_target_capacity_tiers.sql added six helper functions and locked down only
-- the four admin_*/resolve_* entry points around them. Postgres grants EXECUTE to PUBLIC by
-- default, so the moment that migration reached the live project these six became callable by
-- the `anon` role — and because every one of them is SECURITY DEFINER, they run as the owner and
-- read app_targets and tenants with RLS bypassed.
--
-- Verified against the live project with nothing but the public anon key:
--
--   app_target_tier_default_seats('free')  -> 25
--   fleet_unlimited_seat_weight()          -> 5
--   app_target_seats_used(<uuid>)          -> 0
--   app_target_capacity_seats(<uuid>)      -> null
--   tenant_seat_demand(<uuid>)             -> null
--   pick_app_target_for_seats(1)           -> null
--
-- No credentials or customer data are exposed, but this is internal fleet topology on a public
-- endpoint, and the exposure grows as servers are added: pick_app_target_for_seats() returns a
-- real app_targets UUID, which then feeds app_target_seats_used() to read that server's live
-- occupancy. tenant_seat_demand() likewise reports a tenant's seat entitlement to anyone holding
-- a tenant UUID. Both read straight past the RLS policies that exist to prevent exactly that.
--
-- These six have no callers outside the database — they are used only from inside other SECURITY
-- DEFINER functions (pick_app_target_for_seats, admin_app_target_occupancy,
-- provision_tenant_for_new_user). A SECURITY DEFINER function's nested calls are authorized
-- against its owner, not the original caller, so revoking EXECUTE from the client roles leaves
-- every legitimate path working. Nothing in src/, scripts/ or supabase/functions/ calls them
-- directly; AppLinksPage.tsx only re-implements the tier table in TypeScript for display.
--
-- service_role keeps EXECUTE so an Edge Function can use them later without another migration.

revoke all on function public.app_target_tier_default_seats(text) from public, anon, authenticated;
grant execute on function public.app_target_tier_default_seats(text) to service_role;

revoke all on function public.app_target_capacity_seats(uuid) from public, anon, authenticated;
grant execute on function public.app_target_capacity_seats(uuid) to service_role;

revoke all on function public.fleet_unlimited_seat_weight() from public, anon, authenticated;
grant execute on function public.fleet_unlimited_seat_weight() to service_role;

revoke all on function public.tenant_seat_demand(uuid) from public, anon, authenticated;
grant execute on function public.tenant_seat_demand(uuid) to service_role;

revoke all on function public.app_target_seats_used(uuid) from public, anon, authenticated;
grant execute on function public.app_target_seats_used(uuid) to service_role;

revoke all on function public.pick_app_target_for_seats(integer) from public, anon, authenticated;
grant execute on function public.pick_app_target_for_seats(integer) to service_role;

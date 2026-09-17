-- Count only main users (tenant account owners), not sub-users (team members/seats).
-- Each workspace occupies exactly 1 main user slot on its assigned server.

-- 1. Fleet weight for unlimited plans becomes 1 main user
create or replace function public.fleet_unlimited_seat_weight()
returns integer
language sql
immutable
as $$ select 1; $$;

-- 2. Each tenant demands exactly 1 main user slot against server capacity
create or replace function public.tenant_seat_demand(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 1;
$$;

-- 3. Seats used on an app target counts active main users (non-cancelled tenants)
create or replace function public.app_target_seats_used(p_target_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.tenants t
  where t.app_target_id = p_target_id
    and t.status <> 'cancelled';
$$;

-- 4. Permissions — keep locked down to service_role (closed in 20260916000000)
revoke all on function public.app_target_seats_used(uuid) from public, anon, authenticated;
grant execute on function public.app_target_seats_used(uuid) to service_role;

revoke all on function public.tenant_seat_demand(uuid) from public, anon, authenticated;
grant execute on function public.tenant_seat_demand(uuid) to service_role;

revoke all on function public.fleet_unlimited_seat_weight() from public, anon, authenticated;
grant execute on function public.fleet_unlimited_seat_weight() to service_role;

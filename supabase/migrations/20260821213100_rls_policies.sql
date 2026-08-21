-- Row Level Security. Read access is granted here; all writes to entitlement-sensitive
-- tables happen exclusively through the SECURITY DEFINER RPCs in the next migration,
-- so no insert/update/delete policies are defined for 'authenticated' on those tables.

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.super_admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

alter table public.tenants enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.super_admins enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.upgrade_requests enable row level security;

-- tenants: owner can see their own workspace, super admins see everything
create policy tenants_select on public.tenants
  for select
  using (owner_user_id = auth.uid() or public.is_super_admin());

-- subscription_plans: everyone (including anon, for public pricing) sees active plans;
-- super admins also see inactive/hidden plans (e.g. the internal trial plan)
create policy subscription_plans_select on public.subscription_plans
  for select
  using (is_active = true or public.is_super_admin());

-- tenant_subscriptions: owner sees their own subscription, super admins see all
create policy tenant_subscriptions_select on public.tenant_subscriptions
  for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.tenants t
      where t.id = tenant_subscriptions.tenant_id and t.owner_user_id = auth.uid()
    )
  );

-- super_admins: a user can see their own membership row; super admins see the full roster
create policy super_admins_select on public.super_admins
  for select
  using (user_id = auth.uid() or public.is_super_admin());

-- admin_audit_log: super admins only
create policy admin_audit_log_select on public.admin_audit_log
  for select
  using (public.is_super_admin());

-- upgrade_requests: owner can see + file their own requests, super admins see + resolve all
create policy upgrade_requests_select on public.upgrade_requests
  for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.tenants t
      where t.id = upgrade_requests.tenant_id and t.owner_user_id = auth.uid()
    )
  );

create policy upgrade_requests_insert on public.upgrade_requests
  for insert
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = upgrade_requests.tenant_id and t.owner_user_id = auth.uid()
    )
  );

-- Sanctioned write paths for entitlement and super-admin changes. Every mutation here
-- checks public.is_super_admin() itself and logs to admin_audit_log, so authorization is
-- enforced inside the function body (grants alone are not sufficient).

create or replace function public.admin_set_tenant_entitlement(
  p_tenant_id uuid,
  p_plan_id text,
  p_status text,
  p_current_period_end timestamptz default null,
  p_is_lifetime boolean default false,
  p_billing_cycle text default null,
  p_user_limit_override integer default null,
  p_storage_limit_override_mb integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  update public.tenant_subscriptions
  set plan_id = p_plan_id,
      status = p_status,
      current_period_end = p_current_period_end,
      is_lifetime = p_is_lifetime,
      billing_cycle = p_billing_cycle,
      user_limit_override = p_user_limit_override,
      storage_limit_override_mb = p_storage_limit_override_mb
  where tenant_id = p_tenant_id;

  update public.tenants
  set status = p_status
  where id = p_tenant_id;

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (
    auth.uid(), 'set_tenant_entitlement', p_tenant_id,
    jsonb_build_object(
      'plan_id', p_plan_id, 'status', p_status, 'current_period_end', p_current_period_end,
      'is_lifetime', p_is_lifetime, 'billing_cycle', p_billing_cycle
    )
  );
end;
$$;

revoke all on function public.admin_set_tenant_entitlement from public, anon;
grant execute on function public.admin_set_tenant_entitlement to authenticated;

create or replace function public.admin_purge_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_name text;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select business_name into v_business_name from public.tenants where id = p_tenant_id;
  if v_business_name is null then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (auth.uid(), 'purge_tenant', p_tenant_id, jsonb_build_object('business_name', v_business_name));

  delete from public.tenants where id = p_tenant_id;
end;
$$;

revoke all on function public.admin_purge_tenant from public, anon;
grant execute on function public.admin_purge_tenant to authenticated;

create or replace function public.admin_upsert_subscription_plan(
  p_id text,
  p_name text,
  p_description text,
  p_price_monthly_inr integer,
  p_price_yearly_inr integer,
  p_price_lifetime_inr integer,
  p_user_limit integer,
  p_storage_limit_mb integer,
  p_feature_flags jsonb,
  p_is_active boolean,
  p_sort_order integer,
  p_web_app_plan_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.subscription_plans (
    id, name, description, price_monthly_inr, price_yearly_inr, price_lifetime_inr,
    user_limit, storage_limit_mb, feature_flags, is_active, sort_order, web_app_plan_id
  )
  values (
    p_id, p_name, p_description, p_price_monthly_inr, p_price_yearly_inr, p_price_lifetime_inr,
    p_user_limit, p_storage_limit_mb, coalesce(p_feature_flags, '{}'::jsonb), p_is_active, p_sort_order,
    p_web_app_plan_id
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    price_monthly_inr = excluded.price_monthly_inr,
    price_yearly_inr = excluded.price_yearly_inr,
    price_lifetime_inr = excluded.price_lifetime_inr,
    user_limit = excluded.user_limit,
    storage_limit_mb = excluded.storage_limit_mb,
    feature_flags = excluded.feature_flags,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    web_app_plan_id = excluded.web_app_plan_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'upsert_plan', jsonb_build_object('plan_id', p_id));
end;
$$;

revoke all on function public.admin_upsert_subscription_plan from public, anon;
grant execute on function public.admin_upsert_subscription_plan to authenticated;

create or replace function public.admin_resolve_upgrade_request(p_request_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_status not in ('pending','contacted','resolved','dismissed') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.upgrade_requests set status = p_status where id = p_request_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'resolve_upgrade_request', jsonb_build_object('request_id', p_request_id, 'status', p_status));
end;
$$;

revoke all on function public.admin_resolve_upgrade_request from public, anon;
grant execute on function public.admin_resolve_upgrade_request to authenticated;

-- Looking up a user by email requires reading auth.users, which isn't otherwise exposed —
-- this function is the only sanctioned way to resolve an email to a user_id for granting access.
create or replace function public.admin_find_user_by_email(p_email text)
returns table(user_id uuid, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query select u.id, u.email::text from auth.users u where u.email = p_email;
end;
$$;

revoke all on function public.admin_find_user_by_email from public, anon;
grant execute on function public.admin_find_user_by_email to authenticated;

create or replace function public.admin_grant_super_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.super_admins (user_id, granted_by)
  values (p_user_id, auth.uid())
  on conflict (user_id) do nothing;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'grant_super_admin', jsonb_build_object('user_id', p_user_id));
end;
$$;

revoke all on function public.admin_grant_super_admin from public, anon;
grant execute on function public.admin_grant_super_admin to authenticated;

create or replace function public.admin_revoke_super_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot revoke your own super admin access' using errcode = '42501';
  end if;

  delete from public.super_admins where user_id = p_user_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'revoke_super_admin', jsonb_build_object('user_id', p_user_id));
end;
$$;

revoke all on function public.admin_revoke_super_admin from public, anon;
grant execute on function public.admin_revoke_super_admin to authenticated;

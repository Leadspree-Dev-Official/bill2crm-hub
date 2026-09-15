-- Auth hardening from the September 15, 2026 audit.
--
-- 1. The bootstrap super-admin grant no longer fires on an unconfirmed email.
-- 2. admin_find_user_by_email() matches the way Supabase actually stores emails.
-- 3. admin_set_tenant_entitlement() validates its status argument like its sibling RPCs do.

-- ---------------------------------------------------------------------------
-- 1. Bootstrap super admin: require a confirmed email
--
-- provision_tenant_for_new_user() runs AFTER INSERT on auth.users and grants super admin to
-- whoever signs up with the bootstrap address. At that instant email_confirmed_at is still
-- null on any project with confirmations enabled — which the live control plane has
-- (settings report mailer_autoconfirm: false). So the row was written for anyone who merely
-- *claimed* the address, before proving they could read mail sent to it. Signing in still
-- required the confirmation link, so this was not directly exploitable, but it left a
-- super_admins row attached to an unproven account, and it would become exploitable the
-- moment autoconfirm was turned on.
--
-- The grant moves to the confirmation event instead. The insert-time path is kept only for
-- the case where the address is already confirmed at insert (autoconfirm projects, or an
-- admin-created user), so behaviour on such a project is unchanged.

create or replace function public.grant_bootstrap_super_admin(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Carried forward verbatim from 20260909000000_app_target_capacity_tiers.sql.
  v_bootstrap_super_admin_emails text[] := array['arnab.xbox@gmail.com'];
begin
  if p_email is null or lower(p_email) <> all(v_bootstrap_super_admin_emails) then
    return;
  end if;

  insert into public.super_admins (user_id, granted_by)
  values (p_user_id, p_user_id)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.grant_bootstrap_super_admin(uuid, text) from public, anon, authenticated;

create or replace function public.bootstrap_super_admin_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only on the null -> not-null transition, so a later profile update cannot re-trigger it.
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.grant_bootstrap_super_admin(new.id, new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed_bootstrap_super_admin on auth.users;
create trigger on_auth_user_confirmed_bootstrap_super_admin
  after update on auth.users
  for each row execute function public.bootstrap_super_admin_on_confirm();

-- Rewrite the signup trigger's tail so the insert-time grant is confirmation-gated. Every
-- other line is carried forward unchanged from 20260909000000_app_target_capacity_tiers.sql;
-- only the final `if` block differs.
create or replace function public.provision_tenant_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_name text;
  v_base_slug text;
  v_slug text;
  v_tenant_id uuid;
  v_app_target_id uuid;
  v_reserved text[] := array[
    'www','app','api','admin','superadmin','mail','ftp','staging',
    'support','help','status','billing','assets','static','cdn','blog','docs','dashboard'
  ];
begin
  v_business_name := coalesce(nullif(trim(new.raw_user_meta_data->>'businessName'), ''), split_part(new.email, '@', 1));

  v_base_slug := regexp_replace(lower(v_business_name), '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'biz';
  end if;

  v_slug := v_base_slug;
  while v_slug = any(v_reserved) or exists (select 1 from public.tenants where subdomain_slug = v_slug) loop
    v_slug := v_base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  end loop;

  -- Every signup lands on plan_trial, which is an unlimited-seat plan, so weight it as such.
  v_app_target_id := public.pick_app_target_for_seats(public.fleet_unlimited_seat_weight());

  if v_app_target_id is null then
    select id into v_app_target_id from public.app_targets where is_default limit 1;
  end if;

  insert into public.tenants (owner_user_id, business_name, subdomain_slug, status, app_target_id)
  values (new.id, v_business_name, v_slug, 'trial', v_app_target_id)
  returning id into v_tenant_id;

  insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
  values (v_tenant_id, 'plan_trial', 'trial', now() + interval '7 days');

  -- CHANGED from 20260909000000: confirmation-gated. On a project with confirmations on this
  -- is false at insert time and the AFTER UPDATE trigger above performs the grant once the
  -- address is actually proven. Everything above this block is carried forward verbatim.
  if new.email_confirmed_at is not null then
    perform public.grant_bootstrap_super_admin(new.id, new.email);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. admin_find_user_by_email(): case-insensitive, whitespace-tolerant
--
-- GoTrue lowercases addresses on the way in, so the exact `u.email = p_email` match returned
-- zero rows whenever a super admin typed the address with any capital letter — which reads in
-- the UI as "no such user", not "check your capitalisation". Granting super admin starts with
-- this lookup, so the failure mode was a support dead end.
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

  return query
    select u.id, u.email::text
    from auth.users u
    where lower(u.email) = lower(trim(p_email));
end;
$$;

revoke all on function public.admin_find_user_by_email from public, anon;
grant execute on function public.admin_find_user_by_email to authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_set_tenant_entitlement(): validate p_status
--
-- admin_resolve_upgrade_request() validates its status argument; this one did not, leaving the
-- CHECK constraints to reject a bad value. They do reject it, but mid-statement: the
-- tenant_subscriptions UPDATE is attempted first, so the failure surfaces as a constraint
-- error naming an internal table rather than "Invalid status". Same guard, same shape, and it
-- fails before touching anything.
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

  if p_status not in ('trial','active','free','past_due','suspended','cancelled') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  if p_billing_cycle is not null and p_billing_cycle not in ('monthly','yearly','lifetime') then
    raise exception 'Invalid billing cycle' using errcode = '22023';
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

-- Backfill web_app_email and expose tenant owner auth overview for Super Admins.
-- 1. Ensure existing tenants have web_app_email populated from auth.users.
-- 2. Update provision_tenant_for_new_user() to persist web_app_email on insert.
-- 3. Provide admin_get_tenants_auth_overview() RPC to securely read owner email & control plane last_sign_in_at.

update public.tenants t
set web_app_email = u.email
from auth.users u
where t.owner_user_id = u.id and (t.web_app_email is null or t.web_app_email = '');

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

  v_app_target_id := public.pick_app_target_for_seats(public.fleet_unlimited_seat_weight());

  if v_app_target_id is null then
    select id into v_app_target_id from public.app_targets where is_default limit 1;
  end if;

  insert into public.tenants (owner_user_id, business_name, subdomain_slug, status, app_target_id, web_app_email)
  values (new.id, v_business_name, v_slug, 'trial', v_app_target_id, new.email)
  returning id into v_tenant_id;

  insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
  values (v_tenant_id, 'plan_trial', 'trial', now() + interval '7 days');

  if new.email_confirmed_at is not null then
    perform public.grant_bootstrap_super_admin(new.id, new.email);
  end if;

  return new;
end;
$$;

create or replace function public.admin_get_tenants_auth_overview()
returns table (
  tenant_id uuid,
  owner_email text,
  control_plane_last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
  select
    t.id as tenant_id,
    u.email::text as owner_email,
    u.last_sign_in_at as control_plane_last_sign_in_at
  from public.tenants t
  left join auth.users u on u.id = t.owner_user_id;
end;
$$;

revoke all on function public.admin_get_tenants_auth_overview from public, anon;
grant execute on function public.admin_get_tenants_auth_overview to authenticated;

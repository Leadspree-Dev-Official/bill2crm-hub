-- Give every app target an explicit browser-facing URL.
--
-- Until now the Web App address a tenant was sent to was never stored anywhere: both the
-- dashboard (src/lib/supabase.ts -> tenantAppUrl) and launch-app-link derived it as
-- `https://<tenant.subdomain_slug>.<ROOT_DOMAIN>`, with ROOT_DOMAIN = 'bill2crm.in'. That
-- assumed a wildcard-subdomain deployment where every tenant gets its own host under one root
-- domain.
--
-- The live fleet is not deployed that way. The production Web App is served from
-- `https://bill2crm.leadspree.in` — one host per SERVER, shared by every tenant on it, with the
-- tenant identified by the session rather than by the hostname. The derived address
-- (`leadspree.bill2crm.in`) has no DNS record at all, and neither does the `bill2crm.in` root,
-- so "Launch my app" was minting magic links pointing at a host that does not resolve.
--
-- A tenant slug can't be mapped onto that host by any string rule — `bill2crm.leadspree.in` is
-- subdomain "bill2crm" of "leadspree.in", which has nothing to do with the slug "leadspree" —
-- so the address has to be stored per target instead of computed. app_base_url is that address:
-- where a browser reaches this server's Web App frontend. It is deliberately separate from
-- supabase_url, which is that server's API origin and is not what a user is sent to.
--
-- Null keeps the old subdomain derivation, so existing targets that really are wildcard
-- deployments keep working until an admin fills the field in.

alter table public.app_targets
  add column app_base_url text
    check (app_base_url is null or app_base_url ~ '^https://[^/\s]+(/[^\s]*[^/\s])?$');

comment on column public.app_targets.app_base_url is
  'Browser-facing base URL of this server''s Web App frontend, e.g. https://bill2crm.leadspree.in. '
  'No trailing slash. Null falls back to https://<tenant slug>.<ROOT_DOMAIN>, the old wildcard-subdomain derivation.';

-- Backfill the one live server. Matched on the project ref rather than the whole string so it
-- lands whether or not supabase_url was stored with a trailing slash. Verified 2026-09-16:
-- https://bill2crm.leadspree.in serves the Web App and its bundle talks to this exact project.
update public.app_targets
set app_base_url = 'https://bill2crm.leadspree.in'
where app_base_url is null
  and supabase_url like '%xyaabldfxxhemcqeqzuk%';

-- ---------------------------------------------------------------------------------------
-- 1. Resolution — launch-app-link needs the address, not just the API origin.
-- ---------------------------------------------------------------------------------------

-- Return type gains a column, which CREATE OR REPLACE refuses.
drop function if exists public.resolve_app_target(uuid);

create or replace function public.resolve_app_target(p_tenant_id uuid default null)
returns table(target_id uuid, supabase_url text, app_base_url text, service_role_key text)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_target_id uuid;
begin
  if p_tenant_id is not null then
    select app_target_id into v_target_id from public.tenants where id = p_tenant_id;
  end if;

  if v_target_id is null then
    select id into v_target_id from public.app_targets where is_default limit 1;
  end if;

  if v_target_id is null then
    raise exception 'No app link is configured yet — add one in /admin -> App links' using errcode = 'P0002';
  end if;

  return query
    select t.id, t.supabase_url, t.app_base_url, s.decrypted_secret
    from public.app_targets t
    join vault.decrypted_secrets s on s.id = t.vault_secret_id
    where t.id = v_target_id;
end;
$$;

revoke all on function public.resolve_app_target from public, anon, authenticated;
grant execute on function public.resolve_app_target to service_role;

-- ---------------------------------------------------------------------------------------
-- 2. The tenant's own address, for the dashboard.
-- ---------------------------------------------------------------------------------------

-- app_targets is readable only by super admins (RLS), and widening that policy would hand
-- every tenant the fleet's tier and capacity topology — exactly what
-- 20260916000000_lock_down_fleet_capacity_helpers.sql just closed off. So the dashboard gets
-- one scalar for its own row instead: the address it is entitled to open, nothing else.
--
-- Mirrors resolve_app_target's fallback: a tenant with app_target_id = null tracks whatever is
-- default now. Returns null when the target has no address yet, and the caller falls back to
-- the subdomain derivation.
create or replace function public.tenant_app_base_url()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    tgt.app_base_url,
    (select d.app_base_url from public.app_targets d where d.is_default limit 1)
  )
  from public.tenants t
  left join public.app_targets tgt on tgt.id = t.app_target_id
  where t.owner_user_id = auth.uid()
  limit 1;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and this is SECURITY DEFINER — without the
-- revoke it would run as owner for anonymous callers. auth.uid() is null for anon so it would
-- return null rather than leak, but the grant is closed anyway: no anon caller has business
-- here. See 20260916000000_lock_down_fleet_capacity_helpers.sql for the same trap hit live.
revoke all on function public.tenant_app_base_url() from public, anon;
grant execute on function public.tenant_app_base_url() to authenticated;

-- ---------------------------------------------------------------------------------------
-- 3. Admin surface — the address is editable and visible alongside the API origin.
-- ---------------------------------------------------------------------------------------

drop function if exists public.admin_app_target_occupancy();

create or replace function public.admin_app_target_occupancy()
returns table(
  target_id uuid,
  label text,
  supabase_url text,
  app_base_url text,
  tier text,
  is_default boolean,
  capacity_seats integer,
  seats_used integer,
  seats_available integer,
  tenant_count integer,
  is_over_capacity boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return query
    select
      t.id,
      t.label,
      t.supabase_url,
      t.app_base_url,
      t.tier,
      t.is_default,
      coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier)) as capacity_seats,
      public.app_target_seats_used(t.id) as seats_used,
      greatest(
        coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier))
          - public.app_target_seats_used(t.id),
        0
      ) as seats_available,
      (select count(*) from public.tenants tn
        where tn.app_target_id = t.id and tn.status <> 'cancelled')::integer as tenant_count,
      public.app_target_seats_used(t.id)
        > coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier)) as is_over_capacity,
      t.created_at
    from public.app_targets t
    order by t.is_default desc, t.created_at asc;
end;
$$;

revoke all on function public.admin_app_target_occupancy from public, anon;
grant execute on function public.admin_app_target_occupancy to authenticated;

drop function if exists public.admin_create_app_target(text, text, text, boolean, text, integer);

create or replace function public.admin_create_app_target(
  p_label text,
  p_supabase_url text,
  p_service_role_key text,
  p_is_default boolean default false,
  p_tier text default 'free',
  p_capacity_seats_override integer default null,
  p_app_base_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_target_id uuid;
  v_app_base_url text;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_service_role_key), '') = '' then
    raise exception 'Service role key is required' using errcode = '22023';
  end if;
  if p_tier not in ('free', 'pro', 'hosted') then
    raise exception 'Tier must be one of free, pro, hosted' using errcode = '22023';
  end if;
  if p_tier = 'hosted' and p_capacity_seats_override is null then
    raise exception 'A hosted server needs an explicit seat capacity' using errcode = '22023';
  end if;

  -- Tolerate a pasted trailing slash rather than rejecting it on the check constraint: the
  -- address is going to be concatenated with a path, and "https://host/" is what a browser's
  -- address bar hands you when you copy it.
  v_app_base_url := nullif(rtrim(trim(coalesce(p_app_base_url, '')), '/'), '');

  v_secret_id := vault.create_secret(p_service_role_key, p_label);

  insert into public.app_targets (label, supabase_url, vault_secret_id, tier, capacity_seats_override, app_base_url)
  values (p_label, p_supabase_url, v_secret_id, p_tier, p_capacity_seats_override, v_app_base_url)
  returning id into v_target_id;

  if p_is_default or not exists (select 1 from public.app_targets where id <> v_target_id) then
    update public.app_targets set is_default = false where is_default;
    update public.app_targets set is_default = true where id = v_target_id;
  end if;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (
    auth.uid(), 'create_app_target',
    jsonb_build_object(
      'target_id', v_target_id, 'label', p_label, 'supabase_url', p_supabase_url,
      'app_base_url', v_app_base_url,
      'tier', p_tier, 'capacity_seats_override', p_capacity_seats_override
    )
  );

  return v_target_id;
end;
$$;

revoke all on function public.admin_create_app_target from public, anon;
grant execute on function public.admin_create_app_target to authenticated;

drop function if exists public.admin_update_app_target(uuid, text, text, text, text, integer);

create or replace function public.admin_update_app_target(
  p_target_id uuid,
  p_label text,
  p_supabase_url text,
  p_service_role_key text default null,
  p_tier text default null,
  p_capacity_seats_override integer default null,
  p_app_base_url text default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_tier text;
  v_capacity integer;
  v_app_base_url text;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select vault_secret_id into v_secret_id from public.app_targets where id = p_target_id;
  if v_secret_id is null then
    raise exception 'App link not found' using errcode = 'P0002';
  end if;

  v_tier := coalesce(p_tier, (select tier from public.app_targets where id = p_target_id));
  v_capacity := p_capacity_seats_override;
  -- Like capacity, always applied as given: blanking the field clears the address back to the
  -- subdomain derivation rather than silently keeping the old one.
  v_app_base_url := nullif(rtrim(trim(coalesce(p_app_base_url, '')), '/'), '');

  if v_tier not in ('free', 'pro', 'hosted') then
    raise exception 'Tier must be one of free, pro, hosted' using errcode = '22023';
  end if;
  if v_tier = 'hosted' and v_capacity is null then
    raise exception 'A hosted server needs an explicit seat capacity' using errcode = '22023';
  end if;

  if coalesce(trim(p_service_role_key), '') <> '' then
    perform vault.update_secret(v_secret_id, p_service_role_key, p_label);
  end if;

  update public.app_targets
  set label = p_label,
      supabase_url = p_supabase_url,
      tier = v_tier,
      capacity_seats_override = v_capacity,
      app_base_url = v_app_base_url
  where id = p_target_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (
    auth.uid(), 'update_app_target',
    jsonb_build_object(
      'target_id', p_target_id, 'label', p_label, 'supabase_url', p_supabase_url,
      'app_base_url', v_app_base_url,
      'tier', v_tier, 'capacity_seats_override', v_capacity,
      'rotated_key', coalesce(trim(p_service_role_key), '') <> ''
    )
  );
end;
$$;

revoke all on function public.admin_update_app_target from public, anon;
grant execute on function public.admin_update_app_target to authenticated;

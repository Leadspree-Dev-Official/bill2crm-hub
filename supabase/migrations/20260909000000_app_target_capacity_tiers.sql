-- Fleet capacity: give every app target a tier (free | pro | hosted) and derive how many
-- seats it can hold, so signup can place a tenant on a server that actually has room instead
-- of always dumping it on whichever target happens to be `is_default`.
--
-- Capacity is measured in SEATS (end users), not tenants. Tenant counts are still reported
-- per server in /admin -> App links, they just aren't what the limit is enforced against.
--
-- Tuning note: the per-tier seat defaults and the "unlimited plan" weight below are starting
-- values, deliberately isolated in two small functions so a super admin can change them in one
-- place. Any individual server can also override its capacity (`capacity_seats_override`),
-- which is REQUIRED for `hosted` because a self-hosted DigitalOcean/Contabo box's real ceiling
-- depends on the VPS specs, not on anything we can infer from the tier name.

-- ---------------------------------------------------------------------------------------
-- 1. Tier + capacity columns
-- ---------------------------------------------------------------------------------------

alter table public.app_targets
  add column tier text not null default 'free'
    check (tier in ('free', 'pro', 'hosted')),
  add column capacity_seats_override integer
    check (capacity_seats_override is null or capacity_seats_override > 0);

comment on column public.app_targets.tier is
  'free = Supabase free tier, pro = Supabase Pro tier, hosted = self-hosted (DigitalOcean/Contabo).';
comment on column public.app_targets.capacity_seats_override is
  'Explicit seat ceiling for this server. Overrides the tier default. Required when tier = hosted.';

-- A hosted box has no inferable default, so it must carry an explicit number.
alter table public.app_targets
  add constraint app_targets_hosted_needs_capacity
  check (tier <> 'hosted' or capacity_seats_override is not null);

-- ---------------------------------------------------------------------------------------
-- 2. Capacity derivation
-- ---------------------------------------------------------------------------------------

-- Seat ceiling implied by a tier. Returns null for 'hosted' — see the check constraint above.
create or replace function public.app_target_tier_default_seats(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'free' then 25     -- Supabase free tier: 500MB DB / 50k MAU
    when 'pro'  then 200    -- Supabase Pro tier:  8GB DB / 100k MAU
    else null               -- 'hosted': depends on the VPS, must be set per server
  end;
$$;

-- Effective seat ceiling for one target.
create or replace function public.app_target_capacity_seats(p_target_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier))
  from public.app_targets t
  where t.id = p_target_id;
$$;

-- How many seats one tenant is assumed to occupy.
--
-- Site models "unlimited users" as a NULL user_limit (Trial, Private Cloud, Private Cloud
-- Lifetime). An unlimited tenant can't be counted honestly against a finite server, so it is
-- charged this fixed weight instead. Every signup starts on plan_trial, which is unlimited, so
-- this number effectively sets how many fresh signups a server absorbs before it reads as full.
create or replace function public.fleet_unlimited_seat_weight()
returns integer
language sql
immutable
as $$ select 5; $$;

create or replace function public.tenant_seat_demand(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    ts.user_limit_override,
    sp.user_limit,
    public.fleet_unlimited_seat_weight()
  )
  from public.tenants t
  left join public.tenant_subscriptions ts on ts.tenant_id = t.id
  left join public.subscription_plans sp on sp.id = ts.plan_id
  where t.id = p_tenant_id;
$$;

-- Seats currently committed on a server. Cancelled tenants release their seats; suspended ones
-- do not, because a suspended workspace still occupies its data on that server.
create or replace function public.app_target_seats_used(p_target_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    coalesce(ts.user_limit_override, sp.user_limit, public.fleet_unlimited_seat_weight())
  ), 0)::integer
  from public.tenants t
  left join public.tenant_subscriptions ts on ts.tenant_id = t.id
  left join public.subscription_plans sp on sp.id = ts.plan_id
  where t.app_target_id = p_target_id
    and t.status <> 'cancelled';
$$;

-- ---------------------------------------------------------------------------------------
-- 3. Placement
-- ---------------------------------------------------------------------------------------

-- Pick a server with room for p_seats. Prefers the default target so normal signups stay
-- predictable, then falls back to whichever remaining server has the MOST free space (rather
-- than tightest-fit packing) so one nearly-full server doesn't get topped up to the brim.
-- Returns null when the whole fleet is full — callers decide whether that's fatal.
create or replace function public.pick_app_target_for_seats(p_seats integer default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seats integer := coalesce(p_seats, public.fleet_unlimited_seat_weight());
  v_target_id uuid;
begin
  select t.id into v_target_id
  from public.app_targets t
  where t.is_default
    and public.app_target_seats_used(t.id) + v_seats
        <= coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier))
  limit 1;

  if v_target_id is not null then
    return v_target_id;
  end if;

  select t.id into v_target_id
  from public.app_targets t
  where public.app_target_seats_used(t.id) + v_seats
        <= coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier))
  order by
    (coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier))
      - public.app_target_seats_used(t.id)) desc,
    t.created_at asc
  limit 1;

  return v_target_id;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- 4. Signup trigger — place by capacity instead of always taking the default
-- ---------------------------------------------------------------------------------------

-- Unchanged from 20260824120000 except for the app-target selection, which now goes through
-- pick_app_target_for_seats(). When the fleet is full this falls back to the default target
-- so a full fleet degrades to the old behaviour (overflow) rather than blocking signup
-- outright; /admin -> App links surfaces the over-capacity server.
--
-- NOTE: v_bootstrap_super_admin_emails is carried forward verbatim from 20260824120000. It
-- still reads arnab.xbox@gmail.com, which contradicts 20260822100000's retarget to
-- leadspree24x7@gmail.com and the checklist in supabase/README.md. Left as-is here on purpose
-- — changing who gets platform authority is not this migration's business.
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
  v_bootstrap_super_admin_emails text[] := array['arnab.xbox@gmail.com'];
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

  if lower(new.email) = any(v_bootstrap_super_admin_emails) then
    insert into public.super_admins (user_id, granted_by)
    values (new.id, new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- 5. Admin surface
-- ---------------------------------------------------------------------------------------

-- Occupancy for /admin -> App links. Seats are the enforced limit; tenant_count is reported
-- alongside for context.
create or replace function public.admin_app_target_occupancy()
returns table(
  target_id uuid,
  label text,
  supabase_url text,
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

-- Rebuilt to accept tier + capacity. Signature changes, so drop the old one explicitly.
drop function if exists public.admin_create_app_target(text, text, text, boolean);

create or replace function public.admin_create_app_target(
  p_label text,
  p_supabase_url text,
  p_service_role_key text,
  p_is_default boolean default false,
  p_tier text default 'free',
  p_capacity_seats_override integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_target_id uuid;
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

  v_secret_id := vault.create_secret(p_service_role_key, p_label);

  insert into public.app_targets (label, supabase_url, vault_secret_id, tier, capacity_seats_override)
  values (p_label, p_supabase_url, v_secret_id, p_tier, p_capacity_seats_override)
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
      'tier', p_tier, 'capacity_seats_override', p_capacity_seats_override
    )
  );

  return v_target_id;
end;
$$;

revoke all on function public.admin_create_app_target from public, anon;
grant execute on function public.admin_create_app_target to authenticated;

drop function if exists public.admin_update_app_target(uuid, text, text, text);

create or replace function public.admin_update_app_target(
  p_target_id uuid,
  p_label text,
  p_supabase_url text,
  p_service_role_key text default null,
  p_tier text default null,
  p_capacity_seats_override integer default null
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
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select vault_secret_id into v_secret_id from public.app_targets where id = p_target_id;
  if v_secret_id is null then
    raise exception 'App link not found' using errcode = 'P0002';
  end if;

  -- Null tier means "leave it alone". Capacity is always taken as given, so it can be cleared
  -- back to the tier default by passing null on a free/pro server.
  v_tier := coalesce(p_tier, (select tier from public.app_targets where id = p_target_id));
  v_capacity := p_capacity_seats_override;

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
      capacity_seats_override = v_capacity
  where id = p_target_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (
    auth.uid(), 'update_app_target',
    jsonb_build_object(
      'target_id', p_target_id, 'label', p_label, 'supabase_url', p_supabase_url,
      'tier', v_tier, 'capacity_seats_override', v_capacity,
      'rotated_key', coalesce(trim(p_service_role_key), '') <> ''
    )
  );
end;
$$;

revoke all on function public.admin_update_app_target from public, anon;
grant execute on function public.admin_update_app_target to authenticated;

-- Expose tier/capacity to the Edge Function resolvers too, so fleet tooling can reason about
-- capacity without a second round trip. The return type gains columns, and Postgres refuses
-- that under CREATE OR REPLACE, so this has to be dropped first.
drop function if exists public.resolve_all_app_targets();

create or replace function public.resolve_all_app_targets()
returns table(
  target_id uuid,
  label text,
  supabase_url text,
  is_default boolean,
  tier text,
  capacity_seats integer,
  seats_used integer,
  service_role_key text
)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
    select
      t.id, t.label, t.supabase_url, t.is_default, t.tier,
      coalesce(t.capacity_seats_override, public.app_target_tier_default_seats(t.tier)),
      public.app_target_seats_used(t.id),
      s.decrypted_secret
    from public.app_targets t
    join vault.decrypted_secrets s on s.id = t.vault_secret_id
    order by t.created_at;
end;
$$;

revoke all on function public.resolve_all_app_targets from public, anon, authenticated;
grant execute on function public.resolve_all_app_targets to service_role;

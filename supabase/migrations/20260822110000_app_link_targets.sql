-- App link targets: which Web App (product) Supabase project a tenant's "Launch my app"
-- button and entitlement sync actually point at. Until now this was a single hardcoded pair of
-- Edge Function secrets (WEBAPP_SUPABASE_URL / WEBAPP_SUPABASE_SERVICE_ROLE_KEY) shared by
-- every tenant. This generalizes it to a super-admin-managed table: one target is "default"
-- and is stamped onto every new tenant AT SIGNUP TIME (not resolved dynamically), so changing
-- the default later only affects future signups — it can never silently move an existing
-- tenant's app to a different backend. Any individual tenant can also be pointed at a
-- dedicated target (a private/personal cloud instance) independently of the default.
--
-- Each target's service_role key is full-database-access to that Web App project, so it's
-- stored via Supabase Vault (pgsodium-encrypted) rather than a plain column, and is only ever
-- decrypted inside resolve_app_target() below — a function grantable to service_role alone,
-- never to authenticated. No client, including a super admin's own session, can read it back.

create extension if not exists supabase_vault;

create table public.app_targets (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  supabase_url text not null unique,
  vault_secret_id uuid not null unique references vault.secrets(id) on delete restrict,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- At most one default at a time.
create unique index app_targets_one_default on public.app_targets (is_default) where is_default;

alter table public.tenants
  add column app_target_id uuid references public.app_targets(id) on delete restrict;

create index tenants_app_target_id_idx on public.tenants(app_target_id);

alter table public.app_targets enable row level security;

-- Super admins can see labels/urls to manage them in /admin. vault_secret_id is just a
-- pointer — the RLS-visible row never carries the decrypted key.
create policy app_targets_select on public.app_targets
  for select
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------------------
-- Admin RPCs — mirrors the pattern in 20260821213200_admin_rpcs.sql: every mutation checks
-- is_super_admin() itself and logs to admin_audit_log. None of these ever put the plaintext
-- key into the audit payload.
-- ---------------------------------------------------------------------------------------

create or replace function public.admin_create_app_target(
  p_label text,
  p_supabase_url text,
  p_service_role_key text,
  p_is_default boolean default false
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

  v_secret_id := vault.create_secret(p_service_role_key, p_label);

  insert into public.app_targets (label, supabase_url, vault_secret_id)
  values (p_label, p_supabase_url, v_secret_id)
  returning id into v_target_id;

  -- The very first target must become the default, or new signups would have nothing to
  -- resolve to; otherwise only make it default when asked to.
  if p_is_default or not exists (select 1 from public.app_targets where id <> v_target_id) then
    update public.app_targets set is_default = false where is_default;
    update public.app_targets set is_default = true where id = v_target_id;
  end if;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (
    auth.uid(), 'create_app_target',
    jsonb_build_object('target_id', v_target_id, 'label', p_label, 'supabase_url', p_supabase_url)
  );

  return v_target_id;
end;
$$;

revoke all on function public.admin_create_app_target from public, anon;
grant execute on function public.admin_create_app_target to authenticated;

create or replace function public.admin_update_app_target(
  p_target_id uuid,
  p_label text,
  p_supabase_url text,
  p_service_role_key text default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select vault_secret_id into v_secret_id from public.app_targets where id = p_target_id;
  if v_secret_id is null then
    raise exception 'App link not found' using errcode = 'P0002';
  end if;

  if coalesce(trim(p_service_role_key), '') <> '' then
    perform vault.update_secret(v_secret_id, p_service_role_key, p_label);
  end if;

  update public.app_targets set label = p_label, supabase_url = p_supabase_url where id = p_target_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (
    auth.uid(), 'update_app_target',
    jsonb_build_object(
      'target_id', p_target_id, 'label', p_label, 'supabase_url', p_supabase_url,
      'rotated_key', coalesce(trim(p_service_role_key), '') <> ''
    )
  );
end;
$$;

revoke all on function public.admin_update_app_target from public, anon;
grant execute on function public.admin_update_app_target to authenticated;

create or replace function public.admin_set_default_app_target(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.app_targets where id = p_target_id) then
    raise exception 'App link not found' using errcode = 'P0002';
  end if;

  update public.app_targets set is_default = false where is_default;
  update public.app_targets set is_default = true where id = p_target_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'set_default_app_target', jsonb_build_object('target_id', p_target_id));
end;
$$;

revoke all on function public.admin_set_default_app_target from public, anon;
grant execute on function public.admin_set_default_app_target to authenticated;

create or replace function public.admin_delete_app_target(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_is_default boolean;
  v_tenant_count integer;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select vault_secret_id, is_default into v_secret_id, v_is_default
  from public.app_targets where id = p_target_id;
  if v_secret_id is null then
    raise exception 'App link not found' using errcode = 'P0002';
  end if;
  if v_is_default then
    raise exception 'Cannot delete the default app link — set another one as default first' using errcode = '55000';
  end if;

  select count(*) into v_tenant_count from public.tenants where app_target_id = p_target_id;
  if v_tenant_count > 0 then
    raise exception 'Cannot delete — % tenant(s) are still assigned to this app link', v_tenant_count using errcode = '55000';
  end if;

  delete from public.app_targets where id = p_target_id;
  delete from vault.secrets where id = v_secret_id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'delete_app_target', jsonb_build_object('target_id', p_target_id));
end;
$$;

revoke all on function public.admin_delete_app_target from public, anon;
grant execute on function public.admin_delete_app_target to authenticated;

-- p_target_id = null reverts the tenant to whatever is currently the default (dynamically —
-- unlike signup-time stamping, an explicit reassignment-to-null tracks the default going forward).
create or replace function public.admin_reassign_tenant_app_target(p_tenant_id uuid, p_target_id uuid default null)
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
  if p_target_id is not null and not exists (select 1 from public.app_targets where id = p_target_id) then
    raise exception 'App link not found' using errcode = 'P0002';
  end if;

  update public.tenants set app_target_id = p_target_id where id = p_tenant_id;

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (auth.uid(), 'reassign_tenant_app_target', p_tenant_id, jsonb_build_object('target_id', p_target_id));
end;
$$;

revoke all on function public.admin_reassign_tenant_app_target from public, anon;
grant execute on function public.admin_reassign_tenant_app_target to authenticated;

-- ---------------------------------------------------------------------------------------
-- Resolution — called by Edge Functions only (via this project's own service_role key, which
-- is how launch-app-link / sync-tenant-to-webapp / admin-purge-tenant already authenticate for
-- cross-project work). Deliberately not granted to authenticated: this is the one function in
-- the whole schema that returns a plaintext service_role key, so even a super admin's browser
-- session must never be able to call it.
-- ---------------------------------------------------------------------------------------

create or replace function public.resolve_app_target(p_tenant_id uuid default null)
returns table(target_id uuid, supabase_url text, service_role_key text)
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
    select t.id, t.supabase_url, s.decrypted_secret
    from public.app_targets t
    join vault.decrypted_secrets s on s.id = t.vault_secret_id
    where t.id = v_target_id;
end;
$$;

revoke all on function public.resolve_app_target from public, anon, authenticated;
grant execute on function public.resolve_app_target to service_role;

-- ---------------------------------------------------------------------------------------
-- Stamp the current default onto every new tenant at signup time (replaces the version from
-- 20260821213300_signup_trigger.sql / 20260822100000_bootstrap_super_admin_leadspree.sql —
-- only the app_target_id line is new).
-- ---------------------------------------------------------------------------------------

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
  v_target_id uuid;
  v_reserved text[] := array[
    'www','app','api','admin','superadmin','mail','ftp','staging',
    'support','help','status','billing','assets','static','cdn','blog','docs','dashboard'
  ];
  v_bootstrap_super_admin_emails text[] := array['leadspree24x7@gmail.com'];
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

  select id into v_target_id from public.app_targets where is_default limit 1;

  insert into public.tenants (owner_user_id, business_name, subdomain_slug, status, app_target_id)
  values (new.id, v_business_name, v_slug, 'trial', v_target_id)
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

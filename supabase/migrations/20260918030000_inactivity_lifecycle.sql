-- Migration 20260918030000_inactivity_lifecycle.sql
-- Supports the Inactivity Lifecycle Policy:
-- 15 days no login -> paused
-- 30 days -> suspended (auto)
-- 60 days -> purged/deleted

-- 1. Add 'paused' to status check constraint on public.tenants
alter table public.tenants
  drop constraint if exists tenants_status_check;

alter table public.tenants
  add constraint tenants_status_check
  check (status in ('trial','active','free','past_due','paused','suspended','cancelled'));

-- 2. Add 'paused' to status check constraint on public.tenant_subscriptions
alter table public.tenant_subscriptions
  drop constraint if exists tenant_subscriptions_status_check;

alter table public.tenant_subscriptions
  add constraint tenant_subscriptions_status_check
  check (status in ('trial','active','free','past_due','paused','suspended','cancelled'));

-- 3. Add last_activity_at column on public.tenants if not exists
alter table public.tenants
  add column if not exists last_activity_at timestamptz not null default now();

create index if not exists tenants_last_activity_at_idx on public.tenants(last_activity_at);

-- 4. RPC for Super Admin to resume a paused or suspended tenant
create or replace function public.admin_resume_tenant(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_new_status text;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id;
  if not found then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;

  -- Determine appropriate resumed status
  if v_sub.plan_id = 'plan_free' then
    v_new_status := 'free';
  elsif v_sub.is_lifetime or (v_sub.current_period_end is not null and v_sub.current_period_end > now()) then
    v_new_status := 'active';
  elsif v_sub.trial_ends_at is not null and v_sub.trial_ends_at > now() then
    v_new_status := 'trial';
  else
    v_new_status := 'free';
  end if;

  update public.tenant_subscriptions
  set status = v_new_status,
      updated_at = now()
  where tenant_id = p_tenant_id;

  update public.tenants
  set status = v_new_status,
      last_activity_at = now(),
      updated_at = now()
  where id = p_tenant_id;

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (
    auth.uid(), 'resume_tenant', p_tenant_id,
    jsonb_build_object('resumed_status', v_new_status, 'resumed_at', now())
  );

  return v_new_status;
end;
$$;

revoke all on function public.admin_resume_tenant(uuid) from public, anon;
grant execute on function public.admin_resume_tenant(uuid) to authenticated;

-- 5. Helper for Edge Functions (service_role) to touch tenant activity
create or replace function public.touch_tenant_activity(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenants
  set last_activity_at = now(),
      updated_at = now()
  where id = p_tenant_id;
end;
$$;

revoke all on function public.touch_tenant_activity(uuid) from public, anon, authenticated;
grant execute on function public.touch_tenant_activity(uuid) to service_role;

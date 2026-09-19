-- Migration 20260919030000_allow_paused_in_admin_set_tenant_entitlement.sql
-- Allow 'paused' status in admin_set_tenant_entitlement RPC to match
-- the inactivity lifecycle policy and check constraints introduced in 20260918030000_inactivity_lifecycle.sql

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

  if p_status not in ('trial','active','free','past_due','paused','suspended','cancelled') then
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

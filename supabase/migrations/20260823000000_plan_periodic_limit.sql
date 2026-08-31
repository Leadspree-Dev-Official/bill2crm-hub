-- Adds periodic_limit (mirrors the Bill2CRM Web App project's subscription_plans.periodic_limit,
-- a typed column there rather than a feature_flags key) so Site's plan editor can fully author
-- everything the Web App plan model supports.

alter table public.subscription_plans add column if not exists periodic_limit integer;

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
  p_web_app_plan_id text default null,
  p_periodic_limit integer default null
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
    user_limit, storage_limit_mb, feature_flags, is_active, sort_order, web_app_plan_id,
    periodic_limit
  )
  values (
    p_id, p_name, p_description, p_price_monthly_inr, p_price_yearly_inr, p_price_lifetime_inr,
    p_user_limit, p_storage_limit_mb, coalesce(p_feature_flags, '{}'::jsonb), p_is_active, p_sort_order,
    p_web_app_plan_id, p_periodic_limit
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
    web_app_plan_id = excluded.web_app_plan_id,
    periodic_limit = excluded.periodic_limit;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'upsert_plan', jsonb_build_object('plan_id', p_id));
end;
$$;

revoke all on function public.admin_upsert_subscription_plan from public, anon;
grant execute on function public.admin_upsert_subscription_plan to authenticated;

-- admin_upsert_subscription_plan previously overwrote feature_flags wholesale on every save
-- (`feature_flags = excluded.feature_flags`). The admin plan editor only ever sends its own
-- vocabulary (vaultAccess, aiAgentsAccess, websiteBuilderAccess, allowReceiptAttachments,
-- cloudSchedulingAccess, vaultFileLimit), while the public pricing page reads a separate, older
-- set of keys (crm, automated_reminders, doc_vault_limit, priority_support, custom_website) out
-- of the same jsonb column. A wholesale replace silently wiped the pricing page's flags every
-- time a plan was edited, with no error surfaced to the admin.
--
-- Fix: merge the incoming feature_flags into whatever is already stored instead of replacing it.
-- New keys are added, matching existing keys are overwritten (so the admin's toggle changes still
-- take effect), and untouched keys from the other vocabulary survive. The client
-- (src/lib/api/admin.ts) now also merges before calling this RPC, so this is defense-in-depth for
-- any other caller that hits the RPC directly.

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
    feature_flags = coalesce(public.subscription_plans.feature_flags, '{}'::jsonb) || coalesce(excluded.feature_flags, '{}'::jsonb),
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

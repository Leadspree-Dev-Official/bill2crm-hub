-- Restrict plan_free storage limit to 10 MB cap
update public.subscription_plans
set storage_limit_mb = 10,
    updated_at = now()
where id = 'plan_free';

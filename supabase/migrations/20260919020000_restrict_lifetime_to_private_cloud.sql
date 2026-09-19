-- Migration: 20260919020000_restrict_lifetime_to_private_cloud.sql
-- Restrict lifetime pricing to Private Cloud only.
-- Starter and Cloud SaaS run on shared multi-tenant database infrastructure and must not have lifetime billing.

update public.subscription_plans
set price_lifetime_inr = null
where id in ('plan_starter', 'plan_cloud_saas');

update public.subscription_plans
set price_lifetime_inr = 6999
where id = 'plan_private_cloud';

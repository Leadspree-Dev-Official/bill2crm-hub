-- Migration: 20260918130000_update_plan_pricing_and_cycles.sql
-- Ensure all standard paid tiers have monthly, yearly, and lifetime (1-time) pricing.

-- 1. Starter plan: Solo tier
update public.subscription_plans
set price_monthly_inr = 49,
    price_yearly_inr = 499,
    price_lifetime_inr = 1499
where id = 'plan_starter';

-- 2. Cloud SaaS plan: Shared database, team access
update public.subscription_plans
set price_monthly_inr = 149,
    price_yearly_inr = 1499,
    price_lifetime_inr = 3999
where id = 'plan_cloud_saas';

-- 3. Private Cloud plan: Dedicated database, full features
update public.subscription_plans
set price_monthly_inr = 299,
    price_yearly_inr = 2999,
    price_lifetime_inr = 6999
where id = 'plan_private_cloud';

-- 4. Soft-deprecate the standalone lifetime row so it doesn't clutter as a duplicate plan
-- (Private Cloud itself now provides the lifetime billing cycle directly).
update public.subscription_plans
set is_active = false
where id = 'plan_private_cloud_lifetime';

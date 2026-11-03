-- Rename 'Custom' plan to 'Enterprise (Custom)'
update public.subscription_plans
set name = 'Enterprise (Custom)',
    description = 'Dedicated Indian cloud infrastructure, custom white-labeling & VIP SLA — contact for a quote'
where id = 'plan_custom';

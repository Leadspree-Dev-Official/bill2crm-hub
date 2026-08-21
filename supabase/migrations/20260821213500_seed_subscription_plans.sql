-- Starting set of plans, mirroring the marketing site's pricing tiers. All of this is
-- editable later from the /admin console via admin_upsert_subscription_plan() — these
-- are sensible defaults, not hardcoded business rules.

insert into public.subscription_plans
  (id, name, description, price_monthly_inr, price_yearly_inr, price_lifetime_inr,
   user_limit, storage_limit_mb, feature_flags, is_active, sort_order)
values
  ('plan_trial', 'Trial', '7-day free trial — full Private Cloud feature set', null, null, null,
   null, 5120,
   '{"crm": true, "automated_reminders": true, "doc_vault_limit": 50, "priority_support": true}'::jsonb,
   false, 0),

  ('plan_free', 'Free', 'Free forever, limited usage', 0, 0, null,
   1, 100,
   '{"crm": true, "automated_reminders": false, "doc_vault_limit": 0, "priority_support": false, "invoices_per_month": 10}'::jsonb,
   true, 1),

  ('plan_starter', 'Starter', 'Solo · shared database', null, 499, null,
   1, 500,
   '{"crm": true, "automated_reminders": false, "doc_vault_limit": 0, "priority_support": false}'::jsonb,
   true, 2),

  ('plan_cloud_saas', 'Cloud SaaS', 'Supabase · shared database', 149, 1499, null,
   3, 2048,
   '{"crm": true, "automated_reminders": true, "doc_vault_limit": 5, "priority_support": false}'::jsonb,
   true, 3),

  ('plan_private_cloud', 'Private Cloud', 'Your own database · best value', 299, 2999, null,
   null, null,
   '{"crm": true, "automated_reminders": true, "doc_vault_limit": 50, "priority_support": true}'::jsonb,
   true, 4),

  ('plan_private_cloud_lifetime', 'Private Cloud · Lifetime', 'Pay once, own your data', null, null, 6999,
   null, null,
   '{"crm": true, "automated_reminders": true, "doc_vault_limit": 50, "priority_support": false}'::jsonb,
   true, 5),

  ('plan_custom', 'Custom', 'Built around you — contact for a quote', null, null, null,
   null, null,
   '{"crm": true, "automated_reminders": true, "doc_vault_limit": null, "priority_support": true, "custom_website": true}'::jsonb,
   true, 6)
on conflict (id) do nothing;

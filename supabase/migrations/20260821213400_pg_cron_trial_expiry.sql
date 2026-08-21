-- Daily downgrade of expired trials to the Free plan. Runs as postgres, bypassing RLS,
-- and its writes go through the same tables the admin RPCs touch, so the update-webhook
-- configured in the Supabase dashboard (see supabase/README.md) picks the change up and
-- syncs it to the Web App project just like a manual admin change would.

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'expire-trials-daily',
  '0 3 * * *',
  $$
  update public.tenant_subscriptions
  set status = 'free', plan_id = 'plan_free', trial_ends_at = null
  where status = 'trial' and trial_ends_at is not null and trial_ends_at < now();

  update public.tenants t
  set status = 'free'
  from public.tenant_subscriptions ts
  where t.id = ts.tenant_id and ts.status = 'free' and t.status = 'trial';
  $$
);

-- Schedules the renewal loop.
--
-- Both jobs are plain SQL over local tables — no pg_net, no outbound HTTP — so they run
-- wherever pg_cron does and cannot be broken by a function deploy. The Razorpay side needs no
-- nudging from us: in 'auto' mode Razorpay debits the mandate on its own schedule and tells us
-- over the webhook. These jobs cover what Razorpay cannot know about — when to chase a
-- customer, and when to stop serving one who never paid.
--
-- Times are UTC (pg_cron's clock). 02:30 UTC is 08:00 IST, so a reminder that lands in a
-- tenant's dashboard is already there when the working day starts in India.

create extension if not exists pg_cron with schema extensions;

-- Reminders: trial ending, renewal due at each configured offset, grace window closing.
-- Hourly rather than daily because dedupe_key makes repeats free, and an hourly cadence means
-- a tenant who pays at 10am stops being chased by 11am.
do $$
begin
  perform cron.unschedule('billing-followups-hourly');
exception when others then null;
end $$;

select cron.schedule(
  'billing-followups-hourly',
  '20 * * * *',
  $$ select public.billing_generate_followups(); $$
);

-- Dunning: period end -> past_due, then grace exhausted -> paused (or Free, per config).
-- Runs after the reminder job so a tenant is never paused in the same minute they were first
-- told the payment was overdue.
do $$
begin
  perform cron.unschedule('billing-dunning-daily');
exception when others then null;
end $$;

select cron.schedule(
  'billing-dunning-daily',
  '30 2 * * *',
  $$ select public.billing_enforce_dunning(); $$
);

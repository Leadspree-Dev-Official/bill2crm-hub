-- Sanctioned write paths for billing.
--
-- Three audiences, three grant sets:
--   * service_role only  — called by the Razorpay Edge Functions. A browser must never be
--                          able to declare money received, so these are revoked from
--                          authenticated as well as anon.
--   * super admin only   — the offline/manual grant path, gated by is_super_admin() inside
--                          the function body (a grant alone is not an authorization check).
--   * tenant             — dismissing their own follow-up banner, and nothing else.
--
-- Every function is explicitly revoked from public and anon first: Postgres grants EXECUTE on
-- new functions to PUBLIC by default, which on Supabase makes a fresh SECURITY DEFINER
-- function callable by the anon key unless that default is taken away.

-- ---------------------------------------------------------------------------
-- Pure helpers
-- ---------------------------------------------------------------------------

/** End of a billing period that starts at p_from. Lifetime never ends, so it returns null. */
create or replace function public.billing_advance_period(p_cycle text, p_from timestamptz)
returns timestamptz
language sql
immutable
as $$
  select case p_cycle
    when 'monthly' then p_from + interval '1 month'
    when 'yearly'  then p_from + interval '1 year'
    else null
  end;
$$;

revoke all on function public.billing_advance_period(text, timestamptz) from public, anon;
grant execute on function public.billing_advance_period(text, timestamptz) to authenticated, service_role;

/** List price of a plan for a cycle, in paise, excluding GST. Null when that plan is not
 *  sold on that cycle (e.g. a monthly-only plan asked for its lifetime price). */
create or replace function public.billing_plan_price_paise(p_plan_id text, p_cycle text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case p_cycle
    when 'monthly'  then p.price_monthly_inr
    when 'yearly'   then p.price_yearly_inr
    when 'lifetime' then p.price_lifetime_inr
  end::bigint * 100
  from public.subscription_plans p
  where p.id = p_plan_id;
$$;

revoke all on function public.billing_plan_price_paise(text, text) from public, anon;
grant execute on function public.billing_plan_price_paise(text, text) to authenticated, service_role;

/** GST on a base amount, rounded to the nearest paisa. */
create or replace function public.billing_tax_paise(p_base_paise bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select round(p_base_paise * (select gst_percent from public.billing_config where id) / 100.0)::bigint;
$$;

revoke all on function public.billing_tax_paise(bigint) from public, anon;
grant execute on function public.billing_tax_paise(bigint) to authenticated, service_role;

/** Next sequential invoice number. Only called once a payment is actually captured, so the
 *  series has no gaps for abandoned checkouts. */
create or replace function public.billing_next_invoice_no()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'B2C-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' ||
         lpad(nextval('public.billing_invoice_seq')::text, 6, '0');
$$;

revoke all on function public.billing_next_invoice_no() from public, anon, authenticated;
grant execute on function public.billing_next_invoice_no() to service_role;

-- ---------------------------------------------------------------------------
-- Webhook idempotency
-- ---------------------------------------------------------------------------

/** Claims a Razorpay event id. Returns true the first time an event is seen and false for
 *  every redelivery, so the caller can return 200 to Razorpay without applying it twice. */
create or replace function public.billing_claim_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_tenant_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.billing_events (event_id, event_type, payload, tenant_id)
  values (p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb), p_tenant_id);
  return true;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.billing_claim_event(text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.billing_claim_event(text, text, jsonb, uuid) to service_role;

/** Closes out a claimed event. p_error null marks it cleanly processed. */
create or replace function public.billing_finish_event(p_event_id text, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.billing_events
  set processed_at = now(), error = p_error
  where event_id = p_event_id and provider = 'razorpay';
$$;

revoke all on function public.billing_finish_event(text, text) from public, anon, authenticated;
grant execute on function public.billing_finish_event(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- The money path
-- ---------------------------------------------------------------------------

/**
 * Records a captured payment and moves the tenant's entitlement forward by one period.
 *
 * Idempotent on razorpay_payment_id: a redelivered webhook, or a webhook racing the browser's
 * own verify call, finds the existing row and returns it without extending the period twice.
 *
 * The new period starts at the later of "now" and the current period end, so renewing early
 * adds time rather than throwing away what is left.
 *
 * Writing tenant_subscriptions here is what propagates the entitlement to the Web App: the
 * Database Webhook on that table fires sync-tenant-to-webapp exactly as it does for a manual
 * admin change.
 */
create or replace function public.billing_apply_payment(
  p_tenant_id uuid,
  p_plan_id text,
  p_billing_cycle text,
  p_amount_paise bigint,
  p_method text default 'razorpay',
  p_tax_paise bigint default 0,
  p_razorpay_payment_id text default null,
  p_razorpay_order_id text default null,
  p_razorpay_subscription_id text default null,
  p_reference text default null,
  p_captured_at timestamptz default null,
  p_recorded_by uuid default null,
  p_note text default null,
  p_notes jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_payment_id uuid;
  v_sub record;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_is_lifetime boolean := p_billing_cycle = 'lifetime';
  v_captured_at timestamptz := coalesce(p_captured_at, now());
  v_new_status text;
  v_sub_id uuid;
  v_order_id uuid;
begin
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.subscription_plans where id = p_plan_id) then
    raise exception 'Plan % not found', p_plan_id using errcode = 'P0002';
  end if;
  if p_billing_cycle not in ('monthly', 'yearly', 'lifetime') then
    raise exception 'Invalid billing cycle %', p_billing_cycle using errcode = '22023';
  end if;

  -- Idempotency guard. Two callers legitimately race here: the browser's verify call right
  -- after checkout, and Razorpay's webhook for the same payment.
  if p_razorpay_payment_id is not null then
    select id into v_existing_id
    from public.billing_payments
    where razorpay_payment_id = p_razorpay_payment_id;
    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id;

  -- Renewing before expiry extends the existing period instead of resetting it. Switching
  -- plans mid-period restarts from now, because the old plan's remaining time is not
  -- transferable to a different price point.
  if v_sub.current_period_end is not null
     and v_sub.current_period_end > now()
     and v_sub.plan_id = p_plan_id then
    v_period_start := v_sub.current_period_end;
  else
    v_period_start := now();
  end if;

  v_period_end := public.billing_advance_period(p_billing_cycle, v_period_start);
  v_new_status := case when p_plan_id = 'plan_free' then 'free' else 'active' end;

  -- Attach to the tenant's live subscription record, or open one for this payment.
  select id into v_sub_id
  from public.billing_subscriptions
  where tenant_id = p_tenant_id
    and status in ('authenticated', 'active', 'pending', 'halted')
  order by created_at desc
  limit 1;

  if v_sub_id is null and p_razorpay_subscription_id is not null then
    select id into v_sub_id
    from public.billing_subscriptions
    where razorpay_subscription_id = p_razorpay_subscription_id;
  end if;

  if v_sub_id is null then
    insert into public.billing_subscriptions (
      tenant_id, plan_id, billing_cycle, mode, provider, razorpay_subscription_id, status,
      current_period_start, current_period_end, charge_at, paid_count
    )
    values (
      p_tenant_id, p_plan_id, p_billing_cycle,
      case
        when p_razorpay_subscription_id is not null then 'subscription'
        when p_method = 'razorpay' then 'order'
        else 'manual'
      end,
      case when p_method = 'razorpay' then 'razorpay' else 'manual' end,
      p_razorpay_subscription_id,
      case when v_is_lifetime then 'completed' else 'active' end,
      v_period_start, v_period_end, v_period_end, 1
    )
    returning id into v_sub_id;
  else
    update public.billing_subscriptions
    set plan_id = p_plan_id,
        billing_cycle = p_billing_cycle,
        status = case when v_is_lifetime then 'completed' else 'active' end,
        current_period_start = v_period_start,
        current_period_end = v_period_end,
        charge_at = v_period_end,
        paid_count = paid_count + 1,
        razorpay_subscription_id = coalesce(p_razorpay_subscription_id, razorpay_subscription_id)
    where id = v_sub_id;
  end if;

  if p_razorpay_order_id is not null then
    update public.billing_orders
    set status = 'paid', paid_at = v_captured_at
    where razorpay_order_id = p_razorpay_order_id
    returning id into v_order_id;
  end if;

  insert into public.billing_payments (
    tenant_id, plan_id, billing_cycle, subscription_id, order_id, method,
    razorpay_payment_id, razorpay_order_id, razorpay_subscription_id,
    amount_paise, tax_paise, status, reference, invoice_no,
    period_start, period_end, captured_at, recorded_by, note, notes
  )
  values (
    p_tenant_id, p_plan_id, p_billing_cycle, v_sub_id, v_order_id, p_method,
    p_razorpay_payment_id, p_razorpay_order_id, p_razorpay_subscription_id,
    p_amount_paise, coalesce(p_tax_paise, 0), 'captured', p_reference,
    public.billing_next_invoice_no(),
    v_period_start, v_period_end, v_captured_at, p_recorded_by, p_note,
    coalesce(p_notes, '{}'::jsonb)
  )
  -- Two deliveries of the same webhook can reach the early-return check at the same instant
  -- and both get past it. The unique index is the real guard; DO NOTHING turns the loser of
  -- that race into a no-op instead of a 500 that Razorpay would keep retrying.
  on conflict (razorpay_payment_id) do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select id into v_payment_id from public.billing_payments
    where razorpay_payment_id = p_razorpay_payment_id;
    return v_payment_id;
  end if;

  update public.tenant_subscriptions
  set plan_id = p_plan_id,
      status = v_new_status,
      billing_cycle = p_billing_cycle,
      current_period_end = v_period_end,
      is_lifetime = v_is_lifetime,
      trial_ends_at = null
  where tenant_id = p_tenant_id;

  update public.tenants
  set status = v_new_status,
      last_activity_at = now()
  where id = p_tenant_id;

  -- A successful payment closes whatever dunning was chasing it.
  update public.billing_notifications
  set acknowledged_at = now()
  where tenant_id = p_tenant_id
    and acknowledged_at is null
    and kind in ('renewal_due', 'payment_failed', 'grace_ending', 'trial_ending', 'paused');

  insert into public.billing_notifications (tenant_id, kind, severity, title, body, dedupe_key, payload)
  values (
    p_tenant_id, 'payment_received', 'info',
    'Payment received',
    case
      when v_is_lifetime then 'Lifetime access is active. No renewal is due.'
      else 'Your plan is active until ' || to_char(v_period_end at time zone 'Asia/Kolkata', 'DD Mon YYYY') || '.'
    end,
    'payment:' || v_payment_id::text,
    jsonb_build_object('payment_id', v_payment_id, 'amount_paise', p_amount_paise, 'method', p_method)
  )
  on conflict (dedupe_key) do nothing;

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (
    p_recorded_by, 'billing_payment_applied', p_tenant_id,
    jsonb_build_object(
      'payment_id', v_payment_id, 'plan_id', p_plan_id, 'billing_cycle', p_billing_cycle,
      'method', p_method, 'amount_paise', p_amount_paise, 'tax_paise', coalesce(p_tax_paise, 0),
      'razorpay_payment_id', p_razorpay_payment_id, 'period_end', v_period_end
    )
  );

  return v_payment_id;
end;
$$;

revoke all on function public.billing_apply_payment(uuid, text, text, bigint, text, bigint, text, text, text, text, timestamptz, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.billing_apply_payment(uuid, text, text, bigint, text, bigint, text, text, text, text, timestamptz, uuid, text, jsonb)
  to service_role;

/** Mirrors a Razorpay subscription object into billing_subscriptions. Called on
 *  subscription.authenticated / activated / pending / halted / paused / resumed / cancelled /
 *  completed. Never touches entitlement — only billing_apply_payment moves that. */
create or replace function public.billing_sync_subscription(
  p_razorpay_subscription_id text,
  p_status text,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_charge_at timestamptz default null,
  p_paid_count integer default null,
  p_short_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.billing_subscriptions
  set status = p_status,
      current_period_start = coalesce(p_current_period_start, current_period_start),
      current_period_end = coalesce(p_current_period_end, current_period_end),
      charge_at = coalesce(p_charge_at, charge_at),
      paid_count = coalesce(p_paid_count, paid_count),
      short_url = coalesce(p_short_url, short_url),
      cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end
  where razorpay_subscription_id = p_razorpay_subscription_id
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.billing_sync_subscription(text, text, timestamptz, timestamptz, timestamptz, integer, text)
  from public, anon, authenticated;
grant execute on function public.billing_sync_subscription(text, text, timestamptz, timestamptz, timestamptz, integer, text)
  to service_role;

/** Records a failed or refunded payment attempt and raises a follow-up. Entitlement is left
 *  alone: a failed renewal only bites once the grace window closes (billing_enforce_dunning). */
create or replace function public.billing_record_failure(
  p_tenant_id uuid,
  p_razorpay_payment_id text,
  p_amount_paise bigint,
  p_reason text default null,
  p_razorpay_subscription_id text default null,
  p_razorpay_order_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.billing_payments (
    tenant_id, method, razorpay_payment_id, razorpay_order_id, razorpay_subscription_id,
    amount_paise, status, note
  )
  values (
    p_tenant_id, 'razorpay', p_razorpay_payment_id, p_razorpay_order_id, p_razorpay_subscription_id,
    coalesce(p_amount_paise, 0), 'failed', p_reason
  )
  on conflict (razorpay_payment_id) do update set status = 'failed', note = excluded.note
  returning id into v_id;

  if p_razorpay_order_id is not null then
    update public.billing_orders set status = 'failed' where razorpay_order_id = p_razorpay_order_id;
  end if;

  insert into public.billing_notifications (tenant_id, kind, severity, title, body, dedupe_key, payload)
  values (
    p_tenant_id, 'payment_failed', 'warning',
    'Payment could not be collected',
    coalesce(nullif(p_reason, ''), 'The last payment attempt on your subscription failed.') ||
      ' Update your payment method or pay manually to keep the workspace active.',
    'payment_failed:' || coalesce(p_razorpay_payment_id, p_tenant_id::text || ':' || now()::date::text),
    jsonb_build_object('razorpay_payment_id', p_razorpay_payment_id, 'reason', p_reason)
  )
  on conflict (dedupe_key) do nothing;

  return v_id;
end;
$$;

revoke all on function public.billing_record_failure(uuid, text, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.billing_record_failure(uuid, text, bigint, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Super admin: manual / offline grants
-- ---------------------------------------------------------------------------

/**
 * Records money taken outside the gateway (cash, bank transfer, UPI to our own VPA, cheque)
 * and grants the matching entitlement in one step — the "offline payment taken on cash" path.
 *
 * p_amount_inr null bills the plan's own list price for that cycle. Pass an explicit amount
 * for a negotiated price; pass 0 with method 'comp' for a complimentary period.
 */
create or replace function public.admin_record_manual_payment(
  p_tenant_id uuid,
  p_plan_id text,
  p_billing_cycle text,
  p_method text,
  p_amount_inr numeric default null,
  p_reference text default null,
  p_note text default null,
  p_include_gst boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_paise bigint;
  v_tax_paise bigint;
  v_payment_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_method not in ('cash', 'bank_transfer', 'upi_manual', 'cheque', 'comp') then
    raise exception 'Invalid manual payment method %', p_method using errcode = '22023';
  end if;

  if p_amount_inr is null then
    v_base_paise := public.billing_plan_price_paise(p_plan_id, p_billing_cycle);
    if v_base_paise is null then
      raise exception 'Plan % has no % price — enter the amount explicitly', p_plan_id, p_billing_cycle
        using errcode = '22023';
    end if;
  else
    v_base_paise := round(p_amount_inr * 100)::bigint;
  end if;

  v_tax_paise := case when p_include_gst then public.billing_tax_paise(v_base_paise) else 0 end;

  v_payment_id := public.billing_apply_payment(
    p_tenant_id => p_tenant_id,
    p_plan_id => p_plan_id,
    p_billing_cycle => p_billing_cycle,
    p_amount_paise => v_base_paise,
    p_method => p_method,
    p_tax_paise => v_tax_paise,
    p_reference => p_reference,
    p_recorded_by => auth.uid(),
    p_note => p_note,
    p_notes => jsonb_build_object('source', 'manual_admin_entry')
  );

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (
    auth.uid(), 'record_manual_payment', p_tenant_id,
    jsonb_build_object(
      'payment_id', v_payment_id, 'plan_id', p_plan_id, 'billing_cycle', p_billing_cycle,
      'method', p_method, 'amount_paise', v_base_paise, 'reference', p_reference
    )
  );

  return v_payment_id;
end;
$$;

revoke all on function public.admin_record_manual_payment(uuid, text, text, text, numeric, text, text, boolean)
  from public, anon;
grant execute on function public.admin_record_manual_payment(uuid, text, text, text, numeric, text, text, boolean)
  to authenticated;

/**
 * Beta / evaluation access: full entitlement for a fixed number of days with no money
 * involved and no gateway record. Still writes a zero-rupee ledger row so "who is on a free
 * ride, granted by whom, until when" is answerable from the same place as real revenue.
 */
create or replace function public.admin_grant_beta_access(
  p_tenant_id uuid,
  p_plan_id text,
  p_days integer default 30,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_period_end timestamptz;
  v_sub_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'Beta access must be between 1 and 3650 days' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Tenant not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.subscription_plans where id = p_plan_id) then
    raise exception 'Plan % not found', p_plan_id using errcode = 'P0002';
  end if;

  v_period_end := now() + make_interval(days => p_days);

  select id into v_sub_id
  from public.billing_subscriptions
  where tenant_id = p_tenant_id and status in ('authenticated', 'active', 'pending', 'halted')
  order by created_at desc
  limit 1;

  if v_sub_id is null then
    insert into public.billing_subscriptions (
      tenant_id, plan_id, billing_cycle, mode, provider, status,
      current_period_start, current_period_end, charge_at, notes
    )
    values (
      p_tenant_id, p_plan_id, 'monthly', 'manual', 'manual', 'active',
      now(), v_period_end, v_period_end, jsonb_build_object('grant', 'beta')
    )
    returning id into v_sub_id;
  else
    update public.billing_subscriptions
    set plan_id = p_plan_id, mode = 'manual', provider = 'manual', status = 'active',
        current_period_start = now(), current_period_end = v_period_end, charge_at = v_period_end,
        notes = notes || jsonb_build_object('grant', 'beta')
    where id = v_sub_id;
  end if;

  insert into public.billing_payments (
    tenant_id, plan_id, billing_cycle, subscription_id, method, amount_paise, tax_paise,
    status, period_start, period_end, captured_at, recorded_by, note, notes
  )
  values (
    p_tenant_id, p_plan_id, 'monthly', v_sub_id, 'beta', 0, 0,
    'captured', now(), v_period_end, now(), auth.uid(),
    coalesce(p_note, 'Beta / evaluation access'),
    jsonb_build_object('source', 'beta_grant', 'days', p_days)
  )
  returning id into v_payment_id;

  update public.tenant_subscriptions
  set plan_id = p_plan_id,
      status = 'active',
      billing_cycle = 'monthly',
      current_period_end = v_period_end,
      is_lifetime = false,
      trial_ends_at = null
  where tenant_id = p_tenant_id;

  update public.tenants set status = 'active', last_activity_at = now() where id = p_tenant_id;

  update public.billing_notifications
  set acknowledged_at = now()
  where tenant_id = p_tenant_id and acknowledged_at is null
    and kind in ('renewal_due', 'payment_failed', 'grace_ending', 'trial_ending', 'paused');

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (
    auth.uid(), 'grant_beta_access', p_tenant_id,
    jsonb_build_object('plan_id', p_plan_id, 'days', p_days, 'until', v_period_end, 'note', p_note)
  );

  return v_payment_id;
end;
$$;

revoke all on function public.admin_grant_beta_access(uuid, text, integer, text) from public, anon;
grant execute on function public.admin_grant_beta_access(uuid, text, integer, text) to authenticated;

/** Maps one of our plans + cycle onto a Razorpay plan id (Razorpay bills against its own plan
 *  objects). Without this row, auto-debit checkout for that plan is refused rather than
 *  guessed at. */
create or replace function public.admin_set_plan_gateway_map(
  p_plan_id text,
  p_billing_cycle text,
  p_razorpay_plan_id text,
  p_amount_paise bigint default null,
  p_is_active boolean default true
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
  if p_billing_cycle not in ('monthly', 'yearly') then
    raise exception 'Razorpay plans only exist for monthly and yearly cycles' using errcode = '22023';
  end if;

  insert into public.plan_gateway_map (plan_id, billing_cycle, razorpay_plan_id, amount_paise, is_active)
  values (p_plan_id, p_billing_cycle, trim(p_razorpay_plan_id), p_amount_paise, p_is_active)
  on conflict (plan_id, billing_cycle) do update set
    razorpay_plan_id = excluded.razorpay_plan_id,
    amount_paise = excluded.amount_paise,
    is_active = excluded.is_active;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'set_plan_gateway_map',
          jsonb_build_object('plan_id', p_plan_id, 'billing_cycle', p_billing_cycle,
                             'razorpay_plan_id', p_razorpay_plan_id));
end;
$$;

revoke all on function public.admin_set_plan_gateway_map(text, text, text, bigint, boolean) from public, anon;
grant execute on function public.admin_set_plan_gateway_map(text, text, text, bigint, boolean) to authenticated;

create or replace function public.admin_delete_plan_gateway_map(p_plan_id text, p_billing_cycle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  delete from public.plan_gateway_map where plan_id = p_plan_id and billing_cycle = p_billing_cycle;
  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'delete_plan_gateway_map',
          jsonb_build_object('plan_id', p_plan_id, 'billing_cycle', p_billing_cycle));
end;
$$;

revoke all on function public.admin_delete_plan_gateway_map(text, text) from public, anon;
grant execute on function public.admin_delete_plan_gateway_map(text, text) to authenticated;

create or replace function public.admin_update_billing_config(
  p_gst_percent numeric default null,
  p_recurring_mode text default null,
  p_grace_days integer default null,
  p_reminder_days integer[] default null,
  p_dunning_end_action text default null,
  p_razorpay_mode text default null,
  p_razorpay_enabled boolean default null
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

  update public.billing_config
  set gst_percent = coalesce(p_gst_percent, gst_percent),
      recurring_mode = coalesce(p_recurring_mode, recurring_mode),
      grace_days = coalesce(p_grace_days, grace_days),
      reminder_days = coalesce(p_reminder_days, reminder_days),
      dunning_end_action = coalesce(p_dunning_end_action, dunning_end_action),
      razorpay_mode = coalesce(p_razorpay_mode, razorpay_mode),
      razorpay_enabled = coalesce(p_razorpay_enabled, razorpay_enabled)
  where id;

  insert into public.admin_audit_log (actor_user_id, action, payload)
  values (auth.uid(), 'update_billing_config',
          jsonb_build_object('gst_percent', p_gst_percent, 'recurring_mode', p_recurring_mode,
                             'grace_days', p_grace_days, 'dunning_end_action', p_dunning_end_action,
                             'razorpay_mode', p_razorpay_mode, 'razorpay_enabled', p_razorpay_enabled));
end;
$$;

revoke all on function public.admin_update_billing_config(numeric, text, integer, integer[], text, text, boolean)
  from public, anon;
grant execute on function public.admin_update_billing_config(numeric, text, integer, integer[], text, text, boolean)
  to authenticated;

/** Cancels a subscription locally. The Edge Function calls Razorpay first and only reaches
 *  this once the gateway has accepted, so the two cannot disagree about whether it happened.
 *  at_period_end leaves the paid-for time intact; immediate ends entitlement now. */
create or replace function public.admin_cancel_subscription(
  p_tenant_id uuid,
  p_at_period_end boolean default true,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() and not public.is_tenant_owner(p_tenant_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.billing_subscriptions
  set cancel_at_period_end = p_at_period_end,
      status = case when p_at_period_end then status else 'cancelled' end,
      cancelled_at = case when p_at_period_end then cancelled_at else now() end
  where tenant_id = p_tenant_id
    and status in ('created', 'authenticated', 'active', 'pending', 'halted');

  if not p_at_period_end then
    update public.tenant_subscriptions
    set status = 'cancelled', current_period_end = now()
    where tenant_id = p_tenant_id;
    update public.tenants set status = 'cancelled' where id = p_tenant_id;
  end if;

  insert into public.admin_audit_log (actor_user_id, action, target_tenant_id, payload)
  values (auth.uid(), 'cancel_subscription', p_tenant_id,
          jsonb_build_object('at_period_end', p_at_period_end, 'reason', p_reason));
end;
$$;

revoke all on function public.admin_cancel_subscription(uuid, boolean, text) from public, anon;
grant execute on function public.admin_cancel_subscription(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Follow-up generation and dunning. Both are pure SQL over local tables so pg_cron can run
-- them directly, with no outbound HTTP and no pg_net dependency.
-- ---------------------------------------------------------------------------

/**
 * Raises the reminders that make up the "followup" half of the renewal loop:
 * trial ending, renewal due at each configured offset, and grace window closing.
 * Idempotent through dedupe_key — running it hourly produces the same rows as running it once.
 */
create or replace function public.billing_generate_followups()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_row record;
  v_days integer;
  v_created integer := 0;
begin
  select * into v_cfg from public.billing_config where id;

  for v_row in
    select t.id as tenant_id, t.business_name, t.status as tenant_status,
           ts.plan_id, ts.status as sub_status, ts.trial_ends_at, ts.current_period_end,
           ts.is_lifetime, ts.billing_cycle,
           p.name as plan_name
    from public.tenants t
    join public.tenant_subscriptions ts on ts.tenant_id = t.id
    left join public.subscription_plans p on p.id = ts.plan_id
    where ts.is_lifetime = false
      and t.status not in ('cancelled', 'suspended')
  loop
    -- Trial running out
    if v_row.sub_status = 'trial' and v_row.trial_ends_at is not null then
      v_days := (v_row.trial_ends_at::date - current_date);
      if v_days = any(v_cfg.reminder_days) or v_days <= 0 then
        insert into public.billing_notifications (tenant_id, kind, severity, title, body, dedupe_key, payload)
        values (
          v_row.tenant_id, 'trial_ending',
          case when v_days <= 1 then 'critical' when v_days <= 3 then 'warning' else 'info' end,
          case when v_days <= 0 then 'Your trial has ended'
               else 'Your trial ends in ' || v_days || ' day' || case when v_days = 1 then '' else 's' end end,
          'Pick a plan to keep ' || v_row.business_name || ' active. Monthly, yearly and one-time options are all available.',
          'trial_ending:' || v_row.tenant_id::text || ':' || v_row.trial_ends_at::date::text || ':' || v_days::text,
          jsonb_build_object('days_left', v_days, 'trial_ends_at', v_row.trial_ends_at)
        )
        on conflict (dedupe_key) do nothing;
        if found then v_created := v_created + 1; end if;
      end if;
    end if;

    -- Paid plan approaching renewal
    if v_row.sub_status in ('active', 'past_due') and v_row.current_period_end is not null then
      v_days := (v_row.current_period_end::date - current_date);

      if v_days > 0 and v_days = any(v_cfg.reminder_days) then
        insert into public.billing_notifications (tenant_id, kind, severity, title, body, dedupe_key, payload)
        values (
          v_row.tenant_id, 'renewal_due',
          case when v_days <= 1 then 'warning' else 'info' end,
          'Renewal due in ' || v_days || ' day' || case when v_days = 1 then '' else 's' end,
          coalesce(v_row.plan_name, 'Your plan') || ' renews on ' ||
            to_char(v_row.current_period_end at time zone 'Asia/Kolkata', 'DD Mon YYYY') || '.',
          'renewal_due:' || v_row.tenant_id::text || ':' || v_row.current_period_end::date::text || ':' || v_days::text,
          jsonb_build_object('days_left', v_days, 'period_end', v_row.current_period_end,
                             'plan_id', v_row.plan_id, 'billing_cycle', v_row.billing_cycle)
        )
        on conflict (dedupe_key) do nothing;
        if found then v_created := v_created + 1; end if;
      end if;

      -- Past the period end, inside the grace window
      if v_days <= 0 and current_date <= (v_row.current_period_end + make_interval(days => v_cfg.grace_days))::date then
        insert into public.billing_notifications (tenant_id, kind, severity, title, body, dedupe_key, payload)
        values (
          v_row.tenant_id, 'grace_ending', 'critical',
          'Payment overdue',
          'Your subscription expired on ' ||
            to_char(v_row.current_period_end at time zone 'Asia/Kolkata', 'DD Mon YYYY') ||
            '. The workspace will be ' ||
            case v_cfg.dunning_end_action when 'free' then 'moved to the Free plan' else 'paused' end ||
            ' after ' || v_cfg.grace_days || ' day' || case when v_cfg.grace_days = 1 then '' else 's' end || '.',
          'grace_ending:' || v_row.tenant_id::text || ':' || current_date::text,
          jsonb_build_object('period_end', v_row.current_period_end, 'grace_days', v_cfg.grace_days,
                             'plan_id', v_row.plan_id, 'billing_cycle', v_row.billing_cycle)
        )
        on conflict (dedupe_key) do nothing;
        if found then v_created := v_created + 1; end if;
      end if;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.billing_generate_followups() from public, anon, authenticated;
grant execute on function public.billing_generate_followups() to service_role;

/**
 * Enforces the renewal decision the user described: at the end of a period the tenant either
 * pays again, or the account is paused.
 *
 * Two stages so a customer whose auto-debit failed on the due date is not locked out the same
 * morning: period end flips 'active' to 'past_due', and only after grace_days does the
 * configured end action (pause, or downgrade to Free) apply.
 *
 * Lifetime plans, the Free plan and trials are all exempt — trials are handled by
 * expire-trials-daily, which downgrades them to Free.
 */
create or replace function public.billing_enforce_dunning()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_past_due integer := 0;
  v_ended integer := 0;
  v_row record;
  v_end_status text;
begin
  select * into v_cfg from public.billing_config where id;

  -- Stage 1 — period ended, grace still running.
  for v_row in
    select ts.tenant_id
    from public.tenant_subscriptions ts
    join public.tenants t on t.id = ts.tenant_id
    where ts.status = 'active'
      and ts.is_lifetime = false
      and ts.plan_id <> 'plan_free'
      and ts.current_period_end is not null
      and ts.current_period_end < now()
      and t.status not in ('cancelled', 'suspended', 'paused')
  loop
    update public.tenant_subscriptions set status = 'past_due' where tenant_id = v_row.tenant_id;
    update public.tenants set status = 'past_due' where id = v_row.tenant_id;

    insert into public.admin_audit_log (action, target_tenant_id, payload)
    values ('billing_mark_past_due', v_row.tenant_id,
            jsonb_build_object('at', now(), 'grace_days', v_cfg.grace_days));

    v_past_due := v_past_due + 1;
  end loop;

  -- Stage 2 — grace exhausted.
  -- 'past_due' as the end action means "flag it and leave it there", so there is nothing
  -- further to apply; running the loop anyway would re-log the same tenants every night.
  if v_cfg.dunning_end_action = 'past_due' then
    return jsonb_build_object('marked_past_due', v_past_due, 'ended', 0,
                              'end_action', v_cfg.dunning_end_action);
  end if;

  v_end_status := case v_cfg.dunning_end_action when 'free' then 'free' else v_cfg.dunning_end_action end;

  for v_row in
    select ts.tenant_id
    from public.tenant_subscriptions ts
    join public.tenants t on t.id = ts.tenant_id
    where ts.status = 'past_due'
      and ts.is_lifetime = false
      and ts.current_period_end is not null
      and ts.current_period_end + make_interval(days => v_cfg.grace_days) < now()
      and t.status not in ('cancelled', 'suspended')
  loop
    if v_cfg.dunning_end_action = 'free' then
      update public.tenant_subscriptions
      set status = 'free', plan_id = 'plan_free', billing_cycle = null, current_period_end = null
      where tenant_id = v_row.tenant_id;
    else
      update public.tenant_subscriptions set status = v_end_status where tenant_id = v_row.tenant_id;
    end if;

    update public.tenants set status = v_end_status where id = v_row.tenant_id;

    update public.billing_subscriptions
    set status = 'halted'
    where tenant_id = v_row.tenant_id and status in ('active', 'authenticated', 'pending');

    insert into public.billing_notifications (tenant_id, kind, severity, title, body, dedupe_key, payload)
    values (
      v_row.tenant_id, 'paused', 'critical',
      case when v_cfg.dunning_end_action = 'free' then 'Moved to the Free plan' else 'Workspace paused — payment not received' end,
      'We did not receive the renewal payment within the grace window. Pay now, or contact us, to restore full access. Your data is untouched.',
      'dunning_end:' || v_row.tenant_id::text || ':' || current_date::text,
      jsonb_build_object('action', v_cfg.dunning_end_action, 'at', now())
    )
    on conflict (dedupe_key) do nothing;

    insert into public.admin_audit_log (action, target_tenant_id, payload)
    values ('billing_dunning_end', v_row.tenant_id,
            jsonb_build_object('action', v_cfg.dunning_end_action, 'at', now()));

    v_ended := v_ended + 1;
  end loop;

  return jsonb_build_object('marked_past_due', v_past_due, 'ended', v_ended,
                            'end_action', v_cfg.dunning_end_action);
end;
$$;

revoke all on function public.billing_enforce_dunning() from public, anon, authenticated;
grant execute on function public.billing_enforce_dunning() to service_role;

-- ---------------------------------------------------------------------------
-- Read paths
-- ---------------------------------------------------------------------------

/** Dismisses a follow-up. A tenant may only dismiss their own; a super admin may close any,
 *  which is how the /admin follow-up queue is worked through. */
create or replace function public.acknowledge_billing_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.billing_notifications where id = p_id;
  if v_tenant_id is null then
    raise exception 'Notification not found' using errcode = 'P0002';
  end if;
  if not public.is_super_admin() and not public.is_tenant_owner(v_tenant_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.billing_notifications
  set acknowledged_at = now(), acknowledged_by = auth.uid()
  where id = p_id;
end;
$$;

revoke all on function public.acknowledge_billing_notification(uuid) from public, anon;
grant execute on function public.acknowledge_billing_notification(uuid) to authenticated;

/** Revenue and dunning snapshot for /admin -> Billing. Aggregates only; no per-tenant rows,
 *  which the admin console reads through RLS. */
create or replace function public.admin_billing_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'collected_30d_paise', coalesce((
      select sum(amount_paise + tax_paise) from public.billing_payments
      where status = 'captured' and captured_at > now() - interval '30 days'
    ), 0),
    'collected_total_paise', coalesce((
      select sum(amount_paise + tax_paise) from public.billing_payments where status = 'captured'
    ), 0),
    'gateway_30d_paise', coalesce((
      select sum(amount_paise + tax_paise) from public.billing_payments
      where status = 'captured' and method = 'razorpay' and captured_at > now() - interval '30 days'
    ), 0),
    'offline_30d_paise', coalesce((
      select sum(amount_paise + tax_paise) from public.billing_payments
      where status = 'captured' and method in ('cash', 'bank_transfer', 'upi_manual', 'cheque')
        and captured_at > now() - interval '30 days'
    ), 0),
    'active_subscriptions', (
      select count(*) from public.billing_subscriptions where status = 'active'
    ),
    'beta_grants', (
      select count(distinct tenant_id) from public.billing_payments where method = 'beta'
    ),
    'past_due_tenants', (
      select count(*) from public.tenant_subscriptions where status = 'past_due'
    ),
    'renewals_next_7d', (
      select count(*) from public.tenant_subscriptions
      where status = 'active' and is_lifetime = false
        and current_period_end between now() and now() + interval '7 days'
    ),
    'open_followups', (
      select count(*) from public.billing_notifications where acknowledged_at is null
    ),
    'failed_payments_30d', (
      select count(*) from public.billing_payments
      where status = 'failed' and created_at > now() - interval '30 days'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_billing_summary() from public, anon;
grant execute on function public.admin_billing_summary() to authenticated;

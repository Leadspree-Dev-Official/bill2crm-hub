-- Billing core: Razorpay-backed subscriptions plus the offline/manual grant path.
--
-- Why a second set of tables next to tenant_subscriptions: that table is the *entitlement*
-- (what this tenant is allowed to do right now) and the Web App sync reads it. Money is a
-- separate concern with its own lifecycle — a payment can be captured, refunded or disputed
-- long after the entitlement it bought has expired, and a super admin can grant entitlement
-- with no payment at all (beta access, cash collected offline). Keeping them apart means the
-- ledger stays append-only and truthful while the entitlement stays a single mutable row.
--
-- Writes to every table here go through SECURITY DEFINER RPCs (20260918110000_billing_rpcs.sql)
-- or the service_role inside Edge Functions. No table below grants insert/update to
-- `authenticated`, and RLS gives tenants read access to their own rows only.

-- ---------------------------------------------------------------------------
-- Ownership predicate reused by every policy below. Written as a SECURITY DEFINER function
-- rather than an inline EXISTS so the policies do not each need their own read grant on
-- public.tenants, and so the check is identical everywhere.
-- ---------------------------------------------------------------------------
create or replace function public.is_tenant_owner(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_tenant_owner(uuid) from public, anon;
grant execute on function public.is_tenant_owner(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Platform-wide billing settings (single row)
-- ---------------------------------------------------------------------------
create table public.billing_config (
  id boolean primary key default true check (id),
  -- Indian GST added on top of the plan price. The pricing page has always said
  -- "exclusive of 18% GST", so the number charged has to include it.
  gst_percent numeric(5,2) not null default 18 check (gst_percent >= 0 and gst_percent < 100),
  currency text not null default 'INR' check (currency = upper(currency)),
  -- 'auto'   — monthly/yearly go through the Razorpay Subscriptions API, so the customer
  --            authorises a mandate once (UPI Autopay / card / e-NACH) and Razorpay debits
  --            every cycle by itself.
  -- 'manual' — each cycle is a fresh one-time order/payment link the customer pays again.
  --            Use this until Subscriptions is activated on the Razorpay account.
  recurring_mode text not null default 'auto' check (recurring_mode in ('auto', 'manual')),
  -- Days after current_period_end before an unpaid workspace stops being usable.
  grace_days integer not null default 3 check (grace_days >= 0 and grace_days <= 90),
  -- How many days before period end the renewal follow-ups fire.
  reminder_days integer[] not null default '{7,3,1}',
  -- Where a tenant lands when the grace window closes with no payment. 'paused' keeps the
  -- data and lets an admin resume; 'free' downgrades to the free plan instead.
  dunning_end_action text not null default 'paused'
    check (dunning_end_action in ('paused', 'past_due', 'free')),
  -- Informational only — which Razorpay key set the Edge Functions are expected to hold.
  -- The keys themselves are Edge Function secrets and never appear in the database.
  razorpay_mode text not null default 'test' check (razorpay_mode in ('test', 'live')),
  -- Kill switch: when false, the checkout Edge Function refuses to create orders and the
  -- dashboard falls back to the WhatsApp/manual flow.
  razorpay_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.billing_config (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Razorpay customer handles, one per tenant
-- ---------------------------------------------------------------------------
create table public.billing_customers (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  razorpay_customer_id text not null unique,
  email text,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Plan ↔ Razorpay plan mapping
--
-- Razorpay's Subscriptions API bills against *its own* plan objects, created in the Razorpay
-- dashboard or API, with the amount baked in. This maps (our plan, cycle) → that id, the same
-- way subscription_plans.web_app_plan_id maps to the Web App project. A missing row is a hard
-- failure at checkout rather than a silent fallback: charging the wrong Razorpay plan charges
-- the wrong amount.
-- ---------------------------------------------------------------------------
create table public.plan_gateway_map (
  plan_id text not null references public.subscription_plans(id) on delete cascade,
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  razorpay_plan_id text not null,
  -- The amount Razorpay will actually charge, in paise, as configured on that Razorpay plan.
  -- Stored so a drift between our price and the gateway's can be detected before checkout.
  amount_paise bigint check (amount_paise >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, billing_cycle)
);

-- ---------------------------------------------------------------------------
-- Subscriptions (gateway-backed or manual/offline)
-- ---------------------------------------------------------------------------
create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly', 'lifetime')),
  -- 'subscription' — a Razorpay Subscription with a mandate; Razorpay debits each cycle.
  -- 'order'        — one Razorpay order per cycle; the customer pays again each renewal.
  -- 'manual'       — no gateway at all: cash, bank transfer, or a comped/beta grant.
  mode text not null check (mode in ('subscription', 'order', 'manual')),
  provider text not null default 'razorpay' check (provider in ('razorpay', 'manual')),
  razorpay_subscription_id text unique,
  -- Mirrors Razorpay's own subscription states, plus 'created' for one we've made but that
  -- the customer has not authorised yet.
  status text not null default 'created'
    check (status in ('created', 'authenticated', 'active', 'pending', 'halted',
                      'paused', 'cancelled', 'completed', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  -- When Razorpay will attempt the next auto-debit (auto mode), or when we expect the
  -- customer to pay again (manual/order mode).
  charge_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  total_count integer check (total_count is null or total_count > 0),
  paid_count integer not null default 0 check (paid_count >= 0),
  -- Razorpay's hosted authorisation page for this subscription, handy to resend over WhatsApp.
  short_url text,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_subscriptions_tenant_idx on public.billing_subscriptions(tenant_id);
create index billing_subscriptions_status_idx on public.billing_subscriptions(status);
create index billing_subscriptions_charge_at_idx on public.billing_subscriptions(charge_at)
  where status in ('active', 'authenticated', 'pending');

-- At most one subscription in a live state per tenant. 'created' is excluded deliberately:
-- abandoned checkouts pile up there and must not block the next attempt.
create unique index billing_subscriptions_one_live_per_tenant
  on public.billing_subscriptions(tenant_id)
  where status in ('authenticated', 'active', 'pending', 'halted');

-- ---------------------------------------------------------------------------
-- Checkout intents (one-time payments and manual-mode renewals)
-- ---------------------------------------------------------------------------
create table public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly', 'lifetime')),
  purpose text not null default 'new'
    check (purpose in ('new', 'renewal', 'upgrade', 'one_time')),
  razorpay_order_id text unique,
  -- Razorpay Payment Link, used when the renewal is chased over WhatsApp/email rather than
  -- paid inside the dashboard.
  razorpay_payment_link_id text,
  short_url text,
  amount_paise bigint not null check (amount_paise >= 0),
  tax_paise bigint not null default 0 check (tax_paise >= 0),
  currency text not null default 'INR',
  receipt text,
  status text not null default 'created'
    check (status in ('created', 'attempted', 'paid', 'failed', 'expired', 'cancelled')),
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  paid_at timestamptz
);

create index billing_orders_tenant_idx on public.billing_orders(tenant_id);
create index billing_orders_status_idx on public.billing_orders(status);

-- ---------------------------------------------------------------------------
-- Payment ledger — every rupee, gateway or offline. Append-mostly.
-- ---------------------------------------------------------------------------
create sequence public.billing_invoice_seq;

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id text references public.subscription_plans(id),
  billing_cycle text check (billing_cycle in ('monthly', 'yearly', 'lifetime')),
  subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  order_id uuid references public.billing_orders(id) on delete set null,
  -- How the money actually arrived. 'comp' and 'beta' are zero-rupee entitlement grants kept
  -- in the same ledger so the audit trail has no gaps.
  method text not null
    check (method in ('razorpay', 'cash', 'bank_transfer', 'upi_manual', 'cheque', 'comp', 'beta')),
  razorpay_payment_id text unique,
  razorpay_order_id text,
  razorpay_subscription_id text,
  amount_paise bigint not null check (amount_paise >= 0),
  tax_paise bigint not null default 0 check (tax_paise >= 0),
  currency text not null default 'INR',
  status text not null default 'captured'
    check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  -- Human reference for offline money: UTR, cheque number, receipt book entry.
  reference text,
  -- Sequential invoice number, assigned only once money is actually captured.
  invoice_no text unique,
  period_start timestamptz,
  period_end timestamptz,
  captured_at timestamptz,
  refunded_amount_paise bigint not null default 0 check (refunded_amount_paise >= 0),
  -- Who keyed in an offline payment. Null for gateway-settled money.
  recorded_by uuid references auth.users(id) on delete set null,
  note text,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_payments_tenant_idx on public.billing_payments(tenant_id);
create index billing_payments_created_at_idx on public.billing_payments(created_at desc);
create index billing_payments_status_idx on public.billing_payments(status);
create index billing_payments_method_idx on public.billing_payments(method);

-- ---------------------------------------------------------------------------
-- Raw webhook log — also the idempotency key store.
--
-- Razorpay retries a webhook until it gets a 2xx, and can deliver the same event more than
-- once regardless. Every handler starts by claiming the event id here; a duplicate claim
-- fails the unique constraint and the handler returns 200 without re-applying anything.
-- ---------------------------------------------------------------------------
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  -- Razorpay's x-razorpay-event-id header. Unique per delivered event, stable across retries.
  event_id text not null,
  event_type text not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index billing_events_type_idx on public.billing_events(event_type);
create index billing_events_created_at_idx on public.billing_events(created_at desc);
create index billing_events_unprocessed_idx on public.billing_events(created_at)
  where processed_at is null;

-- ---------------------------------------------------------------------------
-- Follow-up queue — the "and then followup" half of the renewal loop.
--
-- Nothing here sends anything by itself. Rows are generated by billing_generate_followups()
-- on a schedule, shown to the tenant in the dashboard and to a super admin in
-- /admin -> Billing, where each one carries a prefilled WhatsApp message. When an email
-- sender is configured later it drains the same queue.
-- ---------------------------------------------------------------------------
create table public.billing_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null
    check (kind in ('trial_ending', 'renewal_due', 'payment_failed', 'grace_ending',
                    'paused', 'payment_received', 'manual_followup')),
  channel text not null default 'in_app' check (channel in ('in_app', 'whatsapp', 'email')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null,
  due_at timestamptz not null default now(),
  sent_at timestamptz,
  -- Set when a super admin marks the follow-up handled, or the tenant dismisses the banner.
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  -- Stable per (tenant, kind, occurrence) so a scheduler that runs twice a day does not
  -- produce two identical reminders.
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index billing_notifications_tenant_idx on public.billing_notifications(tenant_id);
create index billing_notifications_open_idx on public.billing_notifications(due_at)
  where acknowledged_at is null;

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping (public.set_updated_at() comes from the core schema migration)
-- ---------------------------------------------------------------------------
create trigger billing_config_set_updated_at
  before update on public.billing_config
  for each row execute function public.set_updated_at();

create trigger billing_customers_set_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();

create trigger plan_gateway_map_set_updated_at
  before update on public.plan_gateway_map
  for each row execute function public.set_updated_at();

create trigger billing_subscriptions_set_updated_at
  before update on public.billing_subscriptions
  for each row execute function public.set_updated_at();

create trigger billing_payments_set_updated_at
  before update on public.billing_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — read-only for tenants, read-all for super admins, no writes for
-- anyone but the SECURITY DEFINER RPCs and the service_role.
-- ---------------------------------------------------------------------------
alter table public.billing_config enable row level security;
alter table public.billing_customers enable row level security;
alter table public.plan_gateway_map enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_events enable row level security;
alter table public.billing_notifications enable row level security;

-- GST percent and grace window are shown on the pricing page before anyone signs in.
create policy billing_config_select on public.billing_config
  for select using (true);

create policy billing_customers_select on public.billing_customers
  for select using (public.is_super_admin() or public.is_tenant_owner(tenant_id));

-- Which Razorpay plan id we bill against is fleet configuration, not customer-facing.
create policy plan_gateway_map_select on public.plan_gateway_map
  for select using (public.is_super_admin());

create policy billing_subscriptions_select on public.billing_subscriptions
  for select using (public.is_super_admin() or public.is_tenant_owner(tenant_id));

create policy billing_orders_select on public.billing_orders
  for select using (public.is_super_admin() or public.is_tenant_owner(tenant_id));

create policy billing_payments_select on public.billing_payments
  for select using (public.is_super_admin() or public.is_tenant_owner(tenant_id));

create policy billing_events_select on public.billing_events
  for select using (public.is_super_admin());

create policy billing_notifications_select on public.billing_notifications
  for select using (public.is_super_admin() or public.is_tenant_owner(tenant_id));

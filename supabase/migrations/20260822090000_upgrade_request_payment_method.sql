-- Which channel a tenant used to request a plan upgrade. WhatsApp is the only one that's
-- actually payable today — a super admin reviews the request in /admin and grants the
-- entitlement by hand via admin_set_tenant_entitlement. Razorpay/Stripe are surfaced in the
-- picker as "coming soon" (disabled, not wired to any gateway) so this column exists now and
-- the automated flow, when it lands, can filter/report by channel without another migration.
alter table public.upgrade_requests
  add column payment_method text not null default 'whatsapp'
    check (payment_method in ('whatsapp', 'razorpay', 'stripe'));

-- Core control-plane schema: tenants, plans, subscriptions, super admins, audit log.
-- All entitlement-affecting writes go through SECURITY DEFINER RPCs (see 20260821213200_admin_rpcs.sql)
-- rather than direct table access — mirrors the pattern already used by the Bill2CRM Web App project.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  subdomain_slug text not null unique,
  web_app_org_id uuid,
  web_app_email text,
  status text not null default 'trial'
    check (status in ('trial','active','free','past_due','suspended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_owner_user_id_idx on public.tenants(owner_user_id);
create index tenants_subdomain_slug_idx on public.tenants(subdomain_slug);
create index tenants_status_idx on public.tenants(status);

create table public.subscription_plans (
  id text primary key,
  name text not null,
  description text,
  price_monthly_inr integer,
  price_yearly_inr integer,
  price_lifetime_inr integer,
  user_limit integer,
  storage_limit_mb integer,
  feature_flags jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'trial'
    check (status in ('trial','active','free','past_due','suspended','cancelled')),
  billing_cycle text check (billing_cycle in ('monthly','yearly','lifetime')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  is_lifetime boolean not null default false,
  user_limit_override integer,
  storage_limit_override_mb integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  target_tenant_id uuid references public.tenants(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_target_tenant_idx on public.admin_audit_log(target_tenant_id);
create index admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);

create table public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  requested_plan_id text references public.subscription_plans(id),
  note text,
  status text not null default 'pending'
    check (status in ('pending','contacted','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create index upgrade_requests_tenant_id_idx on public.upgrade_requests(tenant_id);

-- generic updated_at bookkeeping
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger tenant_subscriptions_set_updated_at
  before update on public.tenant_subscriptions
  for each row execute function public.set_updated_at();

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- Retargets the one-time bootstrap super admin allowlist from 20260821213300_signup_trigger.sql.
-- No one has signed up on this project yet, so this is a straight swap, not a revoke: whoever
-- signs up with this exact email becomes super admin automatically; nobody else does. Every
-- super admin after that is still granted explicitly via admin_grant_super_admin(), never by
-- email pattern-matching.
create or replace function public.provision_tenant_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_name text;
  v_base_slug text;
  v_slug text;
  v_tenant_id uuid;
  v_reserved text[] := array[
    'www','app','api','admin','superadmin','mail','ftp','staging',
    'support','help','status','billing','assets','static','cdn','blog','docs','dashboard'
  ];
  v_bootstrap_super_admin_emails text[] := array['leadspree24x7@gmail.com'];
begin
  v_business_name := coalesce(nullif(trim(new.raw_user_meta_data->>'businessName'), ''), split_part(new.email, '@', 1));

  v_base_slug := regexp_replace(lower(v_business_name), '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then
    v_base_slug := 'biz';
  end if;

  v_slug := v_base_slug;
  while v_slug = any(v_reserved) or exists (select 1 from public.tenants where subdomain_slug = v_slug) loop
    v_slug := v_base_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  end loop;

  insert into public.tenants (owner_user_id, business_name, subdomain_slug, status)
  values (new.id, v_business_name, v_slug, 'trial')
  returning id into v_tenant_id;

  insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
  values (v_tenant_id, 'plan_trial', 'trial', now() + interval '7 days');

  if lower(new.email) = any(v_bootstrap_super_admin_emails) then
    insert into public.super_admins (user_id, granted_by)
    values (new.id, new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

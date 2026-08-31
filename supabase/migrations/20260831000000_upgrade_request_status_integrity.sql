-- Tenants may FILE an upgrade request; they may not declare its outcome.
--
-- upgrade_requests_insert previously checked only that the row belonged to the
-- caller's tenant, so an owner could POST any status they liked through
-- PostgREST. The client-side Razorpay handler did exactly that (status='paid'),
-- which is both unverifiable from the browser and not a legal value for the
-- CHECK constraint. Status transitions belong to admin_resolve_upgrade_request,
-- which is already gated on is_super_admin().
--
-- This keeps the future gateway integration honest as well: when Razorpay is
-- activated, settlement must arrive through a server-side webhook running as
-- service_role (which bypasses RLS), never from the customer's browser.

drop policy if exists upgrade_requests_insert on public.upgrade_requests;

create policy upgrade_requests_insert on public.upgrade_requests
  for insert
  with check (
    status = 'pending'
    and exists (
      select 1 from public.tenants t
      where t.id = upgrade_requests.tenant_id and t.owner_user_id = auth.uid()
    )
  );

-- There is deliberately no UPDATE or DELETE policy for tenants on this table:
-- with RLS enabled and no permissive policy, both are denied for authenticated
-- callers, so a filed request cannot be edited or withdrawn client-side.

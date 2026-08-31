-- Helper functions for Fleet Management and Target Health Checking
-- Allows service_role callers (Edge Functions and Fleet CLI) to resolve target credentials from Vault securely.

create or replace function public.resolve_app_target_by_id(p_target_id uuid)
returns table(target_id uuid, label text, supabase_url text, service_role_key text)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
    select t.id, t.label, t.supabase_url, s.decrypted_secret
    from public.app_targets t
    join vault.decrypted_secrets s on s.id = t.vault_secret_id
    where t.id = p_target_id;
end;
$$;

revoke all on function public.resolve_app_target_by_id from public, anon, authenticated;
grant execute on function public.resolve_app_target_by_id to service_role;

create or replace function public.resolve_all_app_targets()
returns table(target_id uuid, label text, supabase_url text, is_default boolean, service_role_key text)
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return query
    select t.id, t.label, t.supabase_url, t.is_default, s.decrypted_secret
    from public.app_targets t
    join vault.decrypted_secrets s on s.id = t.vault_secret_id
    order by t.created_at;
end;
$$;

revoke all on function public.resolve_all_app_targets from public, anon, authenticated;
grant execute on function public.resolve_all_app_targets to service_role;

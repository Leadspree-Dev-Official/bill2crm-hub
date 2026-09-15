// DRIFT-001..DRIFT-0NN — is the live control-plane database actually running the schema in
// supabase/migrations, or is it behind?
//
// This exists because the gap is otherwise invisible. `npm run build`, the typecheck and every
// source-level test pass identically whether or not `supabase db push` has ever been run, so a
// database six migrations behind looks exactly like a healthy one from inside the repo. On
// 2026-09-15 it was in fact six behind, and the symptom was a fleet admin page that threw and a
// billing-integrity constraint that simply was not there.
//
// How the probe works without credentials: PostgREST answers 42501 ("permission denied") for an
// object that EXISTS but is not readable/executable by the anonymous role, and PGRST202/PGRST205
// ("could not find ... in the schema cache") for one that is not in the schema at all. So the
// two are distinguishable from outside with nothing but the public anon key, and no row is read.
//
// Trigger functions are deliberately absent from the list: PostgREST never exposes a function
// returning `trigger`, so they are indistinguishable from a missing one by this method.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectConfig, rpc, restGet, objectState, NO_SUCH_ID } from './lib/harness.mjs'

const cfg = projectConfig()
const skip = cfg.configured ? false : 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set'

/** Every callable object the migrations declare, with the migration that introduced it and
 *  arguments that match its signature exactly — a wrong argument NAME is reported by PostgREST
 *  as PGRST202, identically to a missing function, so these have to be right. */
const EXPECTED = [
  // 20260821213100_rls_policies.sql
  { kind: 'fn', name: 'is_super_admin', args: {}, since: '20260821213100' },

  // 20260821213200_admin_rpcs.sql
  { kind: 'fn', name: 'admin_set_tenant_entitlement', since: '20260821213200',
    args: { p_tenant_id: NO_SUCH_ID, p_plan_id: 'plan_free', p_status: 'active' } },
  { kind: 'fn', name: 'admin_purge_tenant', args: { p_tenant_id: NO_SUCH_ID }, since: '20260821213200' },
  { kind: 'fn', name: 'admin_resolve_upgrade_request', since: '20260821213200',
    args: { p_request_id: NO_SUCH_ID, p_status: 'resolved' } },
  { kind: 'fn', name: 'admin_find_user_by_email', args: { p_email: 'probe@example.invalid' }, since: '20260821213200' },
  { kind: 'fn', name: 'admin_grant_super_admin', args: { p_user_id: NO_SUCH_ID }, since: '20260821213200' },
  { kind: 'fn', name: 'admin_revoke_super_admin', args: { p_user_id: NO_SUCH_ID }, since: '20260821213200' },

  // 20260821213000_core_schema.sql
  { kind: 'tb', name: 'tenants', since: '20260821213000' },
  { kind: 'tb', name: 'subscription_plans', since: '20260821213000' },
  { kind: 'tb', name: 'tenant_subscriptions', since: '20260821213000' },
  { kind: 'tb', name: 'super_admins', since: '20260821213000' },
  { kind: 'tb', name: 'admin_audit_log', since: '20260821213000' },
  { kind: 'tb', name: 'upgrade_requests', since: '20260821213000' },

  // 20260822110000_app_link_targets.sql
  { kind: 'tb', name: 'app_targets', since: '20260822110000' },
  { kind: 'fn', name: 'resolve_app_target', args: { p_tenant_id: null }, since: '20260822110000' },
  { kind: 'fn', name: 'admin_set_default_app_target', args: { p_target_id: NO_SUCH_ID }, since: '20260822110000' },
  { kind: 'fn', name: 'admin_delete_app_target', args: { p_target_id: NO_SUCH_ID }, since: '20260822110000' },
  { kind: 'fn', name: 'admin_reassign_tenant_app_target', since: '20260822110000',
    args: { p_tenant_id: NO_SUCH_ID, p_target_id: null } },

  // 20260823120000_fleet_app_target_helpers.sql
  { kind: 'fn', name: 'resolve_app_target_by_id', args: { p_target_id: NO_SUCH_ID }, since: '20260823120000' },
  { kind: 'fn', name: 'resolve_all_app_targets', args: {}, since: '20260823120000' },

  // 20260909000000_app_target_capacity_tiers.sql
  { kind: 'fn', name: 'app_target_tier_default_seats', args: { p_tier: 'standard' }, since: '20260909000000' },
  { kind: 'fn', name: 'app_target_capacity_seats', args: { p_target_id: NO_SUCH_ID }, since: '20260909000000' },
  { kind: 'fn', name: 'fleet_unlimited_seat_weight', args: {}, since: '20260909000000' },
  { kind: 'fn', name: 'tenant_seat_demand', args: { p_tenant_id: NO_SUCH_ID }, since: '20260909000000' },
  { kind: 'fn', name: 'app_target_seats_used', args: { p_target_id: NO_SUCH_ID }, since: '20260909000000' },
  { kind: 'fn', name: 'pick_app_target_for_seats', args: { p_seats: 1 }, since: '20260909000000' },
  { kind: 'fn', name: 'admin_app_target_occupancy', args: {}, since: '20260909000000' },

  // 20260915000000_auth_hardening.sql
  { kind: 'fn', name: 'grant_bootstrap_super_admin', since: '20260915000000',
    args: { p_user_id: NO_SUCH_ID, p_email: 'probe@example.invalid' } },
]

async function probe(obj) {
  const r = obj.kind === 'fn' ? await rpc(cfg, obj.name, obj.args) : await restGet(cfg, `${obj.name}?select=*&limit=1`)
  return objectState(r)
}

// Reported as one test rather than one per object so a lagging database produces a single
// actionable message naming every missing piece and the push that fixes them all.
test('DRIFT-001 the live database has every object the migrations declare', { skip }, async () => {
  const absent = []
  for (const obj of EXPECTED) {
    if ((await probe(obj)) === 'ABSENT') absent.push(obj)
  }

  if (absent.length === 0) return

  const byMigration = new Map()
  for (const o of absent) {
    if (!byMigration.has(o.since)) byMigration.set(o.since, [])
    byMigration.get(o.since).push(`${o.kind} ${o.name}`)
  }
  const detail = [...byMigration.entries()]
    .sort()
    .map(([mig, objs]) => `  ${mig}: ${objs.join(', ')}`)
    .join('\n')

  assert.fail(
    `The live control-plane database is behind supabase/migrations.\n` +
      `${absent.length} declared object(s) are not present:\n${detail}\n\n` +
      `Fix: supabase link --project-ref <control-plane-ref> && supabase db push\n` +
      `Until then the features in those migrations are dead code in production.`,
  )
})

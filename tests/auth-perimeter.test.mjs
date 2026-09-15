// AUTH-001..AUTH-024 — the control plane's authentication and authorization perimeter,
// exercised against the live project over HTTP.
//
// Everything here is a deny-path assertion or a read that must come back empty, plus the two
// reads that are *supposed* to work anonymously (public pricing). Nothing in this file creates
// an account, writes a row, or sends an email, so it is safe to run against production. The one
// RPC family with destructive potential is called with NO_SUCH_ID, so a total authorization
// failure would still delete nothing — it would just return "not found" instead of "not
// authorized", which is exactly the difference these tests look for.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectConfig, restGet, rpc, request, authSettings, NO_SUCH_ID } from './lib/harness.mjs'

const cfg = projectConfig()
const skip = cfg.configured ? false : 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set'

// ---------------------------------------------------------------------------
// Anonymous reads
// ---------------------------------------------------------------------------

const PRIVATE_TABLES = ['tenants', 'super_admins', 'admin_audit_log', 'upgrade_requests', 'tenant_subscriptions', 'app_targets']

for (const table of PRIVATE_TABLES) {
  test(`AUTH-001 anon SELECT on ${table} yields no rows`, { skip }, async () => {
    const r = await restGet(cfg, `${table}?select=*&limit=5`)
    if (r.status === 401 || r.status === 403 || r.status === 404) return // denied outright
    assert.equal(r.status, 200, `unexpected status: ${r.status} ${JSON.stringify(r.body)}`)
    assert.ok(Array.isArray(r.body), `expected a row array, got ${JSON.stringify(r.body).slice(0, 120)}`)
    assert.equal(r.body.length, 0, `${table} leaked ${r.body.length} rows to an anonymous caller`)
  })
}

test('AUTH-002 anon CAN read active plans, so public pricing renders', { skip }, async () => {
  const r = await restGet(cfg, 'subscription_plans?select=id,name,is_active&limit=50')
  assert.equal(r.status, 200)
  assert.ok(Array.isArray(r.body) && r.body.length > 0, 'public pricing has no plans to show')
})

test('AUTH-003 anon sees only active plans, never internal ones', { skip }, async () => {
  const r = await restGet(cfg, 'subscription_plans?select=id,is_active&limit=50')
  const leaked = (r.body || []).filter((p) => p.is_active === false)
  assert.equal(leaked.length, 0, `inactive plans visible anonymously: ${leaked.map((p) => p.id).join(', ')}`)
})

// ---------------------------------------------------------------------------
// Anonymous writes
// ---------------------------------------------------------------------------

const WRITE_ATTEMPTS = [
  ['super_admins', { user_id: NO_SUCH_ID }],
  ['tenants', { owner_user_id: NO_SUCH_ID, business_name: 'probe', subdomain_slug: 'probe-rls-check' }],
  ['admin_audit_log', { action: 'probe', payload: {} }],
  ['tenant_subscriptions', { tenant_id: NO_SUCH_ID, plan_id: 'plan_free' }],
]

for (const [table, row] of WRITE_ATTEMPTS) {
  test(`AUTH-004 anon INSERT into ${table} is refused`, { skip }, async () => {
    const r = await request(cfg, table, { method: 'POST', body: row })
    assert.ok(r.status >= 400, `anonymous INSERT into ${table} was ACCEPTED (HTTP ${r.status})`)
  })
}

// ---------------------------------------------------------------------------
// Privileged RPCs
// ---------------------------------------------------------------------------

const ADMIN_RPCS = [
  ['admin_grant_super_admin', { p_user_id: NO_SUCH_ID }],
  ['admin_revoke_super_admin', { p_user_id: NO_SUCH_ID }],
  ['admin_find_user_by_email', { p_email: 'probe@example.invalid' }],
  ['admin_purge_tenant', { p_tenant_id: NO_SUCH_ID }],
  ['admin_set_tenant_entitlement', { p_tenant_id: NO_SUCH_ID, p_plan_id: 'plan_free', p_status: 'active' }],
  ['admin_resolve_upgrade_request', { p_request_id: NO_SUCH_ID, p_status: 'resolved' }],
  ['admin_upsert_subscription_plan', { p_id: 'probe', p_name: 'probe', p_description: null, p_price_monthly_inr: 0, p_price_yearly_inr: 0, p_price_lifetime_inr: 0, p_user_limit: 1, p_storage_limit_mb: 1, p_feature_flags: {}, p_is_active: false, p_sort_order: 0 }],
  ['admin_reassign_tenant_app_target', { p_tenant_id: NO_SUCH_ID, p_target_id: null }],
]

for (const [fn, args] of ADMIN_RPCS) {
  test(`AUTH-005 anon call to ${fn}() is refused`, { skip }, async () => {
    const r = await rpc(cfg, fn, args)
    const refused =
      r.status === 401 || r.status === 403 || r.status === 404 ||
      /not authorized|permission denied/i.test(JSON.stringify(r.body))
    assert.ok(refused, `${fn}() answered an anonymous caller with HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`)
  })
}

test('AUTH-006 the service_role-only target resolvers reject anon outright', { skip }, async () => {
  // These carry decrypted Web App service_role keys in their result set, so "denied" is the
  // only acceptable answer — including the PGRST202 that a not-yet-deployed project returns.
  for (const fn of ['resolve_app_target', 'resolve_app_target_by_id', 'resolve_all_app_targets']) {
    const r = await rpc(cfg, fn, fn === 'resolve_app_target_by_id' ? { p_target_id: NO_SUCH_ID } : { p_tenant_id: null })
    assert.ok(r.status >= 400, `${fn}() answered anon with HTTP ${r.status}`)
    assert.ok(
      !JSON.stringify(r.body).includes('service_role_key'),
      `${fn}() leaked a service_role key to an anonymous caller`,
    )
  }
})

// ---------------------------------------------------------------------------
// Internal helpers must not be reachable from the public API
// ---------------------------------------------------------------------------

// Postgres grants EXECUTE to PUBLIC by default, which includes `anon`. A migration that adds a
// SECURITY DEFINER helper and forgets the matching `revoke` therefore publishes an
// RLS-bypassing function to the internet, silently and with no error anywhere.
//
// That is exactly what 20260909000000_app_target_capacity_tiers.sql did: it locked down its four
// admin_*/resolve_* entry points and left these six world-executable. Live, anonymously,
// app_target_tier_default_seats('free') answered 25 and fleet_unlimited_seat_weight() answered 5,
// and pick_app_target_for_seats() would hand out a real app_targets UUID to feed to
// app_target_seats_used(). Closed by 20260916000000_lock_down_fleet_capacity_helpers.sql.
const INTERNAL_HELPERS = [
  ['app_target_tier_default_seats', { p_tier: 'free' }],
  ['app_target_capacity_seats', { p_target_id: NO_SUCH_ID }],
  ['fleet_unlimited_seat_weight', {}],
  ['tenant_seat_demand', { p_tenant_id: NO_SUCH_ID }],
  ['app_target_seats_used', { p_target_id: NO_SUCH_ID }],
  ['pick_app_target_for_seats', { p_seats: 1 }],
]

for (const [fn, args] of INTERNAL_HELPERS) {
  test(`AUTH-012 internal helper ${fn}() is not executable by anon`, { skip }, async () => {
    const r = await rpc(cfg, fn, args)
    assert.ok(
      r.status >= 400,
      `${fn}() is world-executable and SECURITY DEFINER, so it reads past RLS for any anonymous ` +
        `caller. It answered HTTP ${r.status} with ${JSON.stringify(r.body).slice(0, 120)}. ` +
        `Add "revoke all on function public.${fn} from public, anon, authenticated;" to the ` +
        `migration that creates it.`,
    )
  })
}

test('AUTH-007 is_super_admin() is false for an unauthenticated caller', { skip }, async () => {
  const r = await rpc(cfg, 'is_super_admin', {})
  if (r.status >= 400) return // revoked from anon entirely, also fine
  assert.equal(r.body, false, 'is_super_admin() returned true without a session')
})

// ---------------------------------------------------------------------------
// Project auth configuration
// ---------------------------------------------------------------------------

test('AUTH-008 anonymous sign-ins are disabled', { skip }, async () => {
  const s = await authSettings(cfg)
  assert.equal(s.external.anonymous_users, false, 'anonymous sign-ins are enabled on the control plane')
})

test('AUTH-009 email confirmation is required before a session exists', { skip }, async () => {
  const s = await authSettings(cfg)
  assert.equal(
    s.mailer_autoconfirm,
    false,
    'mailer_autoconfirm is ON: anyone can hold an account for an address they cannot read. ' +
      'The signup trigger grants the bootstrap super admin by email match, so this must stay off.',
  )
})

test('AUTH-010 signup is reachable (the trial funnel is not accidentally closed)', { skip }, async () => {
  const s = await authSettings(cfg)
  assert.equal(s.disable_signup, false, 'signup is disabled — no one can start a trial')
})

test('AUTH-011 no third-party identity provider is enabled unreviewed', { skip }, async () => {
  const s = await authSettings(cfg)
  const enabled = Object.entries(s.external).filter(([, on]) => on === true).map(([k]) => k)
  assert.deepEqual(
    enabled.sort(),
    ['email'],
    `unexpected identity providers enabled: ${enabled.join(', ')} — each one is another way into every workspace`,
  )
})

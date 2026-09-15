// GUARD-001..GUARD-014 — the control-plane UI's access-control boundary, as a decision table.
//
// These run the real functions from src/lib/route-decision.ts, compiled on the fly, rather than
// a copy of their logic. The cases that matter most are the password-recovery ones: a recovery
// session IS a session, so a guard that tests `hasSession` first lets a user who has proved
// nothing but mailbox access into the dashboard — or, in the /admin case, into the admin
// surface — with their password still unchanged.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/harness.mjs'

// Strip the types and import the real module, so these tests cannot drift from the source.
const src = fs.readFileSync(path.join(ROOT, 'src/lib/route-decision.ts'), 'utf8')
const js = src
  .replace(/export interface [\s\S]*?\n}\n/g, '')
  .replace(/export type GuardOutcome[\s\S]*?\n\n/, '')
  .replace(/: GuardState/g, '')
  .replace(/: GuardOutcome/g, '')
const tmp = path.join(ROOT, 'tests', '.route-decision.generated.mjs')
fs.writeFileSync(tmp, js)
const { decideRequireAuth, decideRequireSuperAdmin, decideRedirectIfAuthed } = await import(`file://${tmp}`)
process.on('exit', () => fs.existsSync(tmp) && fs.unlinkSync(tmp))

const state = (o = {}) => ({
  loading: false,
  hasSession: false,
  isSuperAdmin: false,
  isPasswordRecovery: false,
  ...o,
})

// --- RequireAuth -----------------------------------------------------------

test('GUARD-001 RequireAuth waits while auth state is still loading', () => {
  assert.deepEqual(decideRequireAuth(state({ loading: true })), { kind: 'spinner' })
})

test('GUARD-002 RequireAuth sends a signed-out visitor to /login', () => {
  assert.deepEqual(decideRequireAuth(state()), { kind: 'redirect', to: '/login' })
})

test('GUARD-003 RequireAuth admits a signed-in user', () => {
  assert.deepEqual(decideRequireAuth(state({ hasSession: true })), { kind: 'allow' })
})

test('GUARD-004 RequireAuth diverts a recovery session to /reset-password, not the dashboard', () => {
  assert.deepEqual(
    decideRequireAuth(state({ hasSession: true, isPasswordRecovery: true })),
    { kind: 'redirect', to: '/reset-password' },
  )
})

test('GUARD-005 recovery outranks loading=false + session, in that order', () => {
  // Guards against a future reordering that checks hasSession first.
  const s = state({ hasSession: true, isSuperAdmin: true, isPasswordRecovery: true })
  assert.equal(decideRequireAuth(s).to, '/reset-password')
  assert.equal(decideRequireSuperAdmin(s).to, '/reset-password')
  assert.equal(decideRedirectIfAuthed(s).to, '/reset-password')
})

// --- RequireSuperAdmin -----------------------------------------------------

test('GUARD-006 RequireSuperAdmin waits while loading', () => {
  assert.deepEqual(decideRequireSuperAdmin(state({ loading: true })), { kind: 'spinner' })
})

test('GUARD-007 RequireSuperAdmin sends a signed-out visitor to /login', () => {
  assert.deepEqual(decideRequireSuperAdmin(state()), { kind: 'redirect', to: '/login' })
})

test('GUARD-008 RequireSuperAdmin turns an ordinary tenant away from /admin', () => {
  assert.deepEqual(
    decideRequireSuperAdmin(state({ hasSession: true, isSuperAdmin: false })),
    { kind: 'redirect', to: '/dashboard' },
  )
})

test('GUARD-009 RequireSuperAdmin admits a super admin', () => {
  assert.deepEqual(decideRequireSuperAdmin(state({ hasSession: true, isSuperAdmin: true })), { kind: 'allow' })
})

test('GUARD-010 isSuperAdmin alone never substitutes for a session', () => {
  // isSuperAdmin is derived from a query that returns nothing when signed out, but if it were
  // ever seeded or cached true, a missing session must still win.
  assert.deepEqual(
    decideRequireSuperAdmin(state({ hasSession: false, isSuperAdmin: true })),
    { kind: 'redirect', to: '/login' },
  )
})

// --- RedirectIfAuthed ------------------------------------------------------

test('GUARD-011 RedirectIfAuthed shows /login to a signed-out visitor', () => {
  assert.deepEqual(decideRedirectIfAuthed(state()), { kind: 'allow' })
})

test('GUARD-012 RedirectIfAuthed bounces a signed-in visitor to the dashboard', () => {
  assert.deepEqual(decideRedirectIfAuthed(state({ hasSession: true })), { kind: 'redirect', to: '/dashboard' })
})

test('GUARD-013 RedirectIfAuthed waits while loading rather than flashing the login form', () => {
  assert.deepEqual(decideRedirectIfAuthed(state({ loading: true, hasSession: true })), { kind: 'spinner' })
})

test('GUARD-014 no guard ever allows while loading', () => {
  const loading = state({ loading: true, hasSession: true, isSuperAdmin: true })
  for (const decide of [decideRequireAuth, decideRequireSuperAdmin, decideRedirectIfAuthed]) {
    assert.equal(decide(loading).kind, 'spinner', `${decide.name} rendered before auth state settled`)
  }
})

// RECOV-001..RECOV-008 — the password-reset screen must survive the race it actually loses.
//
// The failure this covers: createClient() runs at module import and parses the recovery hash
// there, emitting PASSWORD_RECOVERY to whoever is listening at that instant and stripping the
// hash on its way through. ResetPasswordPage mounts later, so its own listener routinely misses
// the event — and then found an empty hash and told a user holding a valid, unexpired reset
// link that the link was "invalid or has expired". The only way out was to request another one,
// which lost the same race.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/harness.mjs'

const page = fs.readFileSync(path.join(ROOT, 'src/pages/auth/ResetPasswordPage.tsx'), 'utf8')
const ctx = fs.readFileSync(path.join(ROOT, 'src/lib/auth-context.tsx'), 'utf8')

test('RECOV-001 the recovery state is persisted, not just held in React state', () => {
  assert.match(ctx, /sessionStorage/, 'a reload of /reset-password loses the recovery flag')
  assert.match(ctx, /RECOVERY_FLAG_KEY/)
})

test('RECOV-002 the flag is per-tab and not localStorage', () => {
  assert.ok(
    !/localStorage\.setItem\(\s*RECOVERY_FLAG_KEY/.test(ctx),
    'the recovery flag must not leak into other tabs or outlive the tab',
  )
})

test('RECOV-003 reading and writing the flag tolerates storage being unavailable', () => {
  // Private windows and hardened browser settings throw on any storage access; an exception
  // here would take down the whole provider on mount.
  const readFn = ctx.slice(ctx.indexOf('export function readRecoveryFlag'))
  const writeFn = ctx.slice(ctx.indexOf('export function writeRecoveryFlag'))
  assert.match(readFn.slice(0, 400), /try\s*\{[\s\S]*?\}\s*catch/)
  assert.match(writeFn.slice(0, 500), /try\s*\{[\s\S]*?\}\s*catch/)
})

test('RECOV-004 the page does not conclude "invalid" from an empty hash alone', () => {
  assert.ok(
    !/window\.location\.hash\.includes\('type=recovery'\) \? 'ready' : 'invalid'/.test(page),
    'the page still decides validity from a hash that Supabase has already consumed',
  )
})

test('RECOV-005 the page consults the persisted flag and the context, not only its own listener', () => {
  assert.match(page, /readRecoveryFlag\(\)/)
  assert.match(page, /isPasswordRecovery/)
})

test('RECOV-006 the late fallback checks for a real session before declaring failure', () => {
  const timeoutBlock = page.slice(page.indexOf('const timeout = setTimeout'))
  assert.match(timeoutBlock.slice(0, 700), /supabase\.auth\.getSession\(\)/)
})

test('RECOV-007 the flag is cleared once the password actually changes', () => {
  const submit = page.slice(page.indexOf('async function onSubmit'))
  assert.ok(
    submit.indexOf('writeRecoveryFlag(false)') !== -1 &&
      submit.indexOf('writeRecoveryFlag(false)') < submit.indexOf('signOut()'),
    'a stale recovery flag traps the user on /reset-password after a successful change',
  )
})

test('RECOV-008 signing out clears the flag', () => {
  const signOut = ctx.slice(ctx.indexOf('const signOut = useCallback'))
  assert.match(signOut.slice(0, 300), /writeRecoveryFlag\(false\)/)
})

test('RECOV-009 the stated link lifetime matches the project otp_expiry', () => {
  const config = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8')
  const seconds = Number(config.match(/^otp_expiry = (\d+)$/m)?.[1])
  assert.equal(seconds, 3600, 'otp_expiry changed — the copy on the reset screens must follow')
  assert.ok(
    !/30 minutes/.test(page),
    'the screen promises 30 minutes while the project issues links valid for an hour',
  )
})

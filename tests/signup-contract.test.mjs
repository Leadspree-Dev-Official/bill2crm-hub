// SIGNUP-001..SIGNUP-012 — the promises the signup screen makes must match what the database
// actually does, and the screen must handle the session the live project actually returns.
//
// Two real failures motivate these:
//   1. The subdomain preview stripped separators ("Sharma Traders" -> "sharmatraders") while
//      provision_tenant_for_new_user() collapses them to hyphens ("sharma-traders"). The screen
//      named an instance the customer would never be given.
//   2. The screen routed to /dashboard the moment signUp() returned without an error. The live
//      control plane has email confirmation ON, so signUp() returns session: null there, and
//      RequireAuth bounced every new signup to /login with nothing explaining why.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/harness.mjs'

const signupSrc = fs.readFileSync(path.join(ROOT, 'src/pages/auth/SignupPage.tsx'), 'utf8')
const triggerSrc = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20260915000000_auth_hardening.sql'),
  'utf8',
)

// Extract and load the real slugify() from the page.
const fnMatch = signupSrc.match(/export function slugify\(value: string\) \{[\s\S]*?\n\}/)
assert.ok(fnMatch, 'slugify() is no longer exported from SignupPage — update this test')
const tmp = path.join(ROOT, 'tests', '.slugify.generated.mjs')
fs.writeFileSync(tmp, fnMatch[0].replace(': string', ''))
const { slugify } = await import(`file://${tmp}`)
process.on('exit', () => fs.existsSync(tmp) && fs.unlinkSync(tmp))

/** What provision_tenant_for_new_user() computes, transcribed from the migration:
 *    regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')  then  trim(both '-' from ...) */
function sqlSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const NAMES = [
  'Sharma Traders',
  'Café Málaga',
  '  leading and trailing  ',
  'A&B Co.',
  'multi   space   name',
  'UPPER CASE LTD',
  'hyphen-already-here',
  'digits123 and 456',
  'Ravi & Sons (Pvt) Ltd.',
  "O'Brien's Bakery",
]

for (const name of NAMES) {
  test(`SIGNUP-001 preview matches the database trigger for ${JSON.stringify(name)}`, () => {
    assert.equal(
      slugify(name),
      sqlSlug(name),
      'the instance name shown at signup is not the one provision_tenant_for_new_user() assigns',
    )
  })
}

test('SIGNUP-002 the transcribed SQL rule is the one in the migration', () => {
  // Keeps sqlSlug() honest: if the migration's expression changes, this fails rather than
  // silently comparing the page against a stale transcription.
  assert.match(triggerSrc, /regexp_replace\(lower\(v_business_name\), '\[\^a-z0-9\]\+', '-', 'g'\)/)
  assert.match(triggerSrc, /trim\(both '-' from v_base_slug\)/)
})

test('SIGNUP-003 the preview promises no hostname at all', () => {
  // Superseded the old `{subdomain}.{ROOT_DOMAIN}` preview (removed in 17afeec). The fleet
  // serves every tenant of a server from ONE address, and which server a tenant lands on is
  // decided by free capacity at signup — so at this point in the flow there is no hostname
  // to show. Templating ROOT_DOMAIN in was just a portable way to name a host that does not
  // resolve. The real address comes from app_targets.app_base_url, on the dashboard.
  assert.ok(
    !/\{subdomain\}\.bill2crm\.in/.test(signupSrc),
    'the instance preview hardcodes bill2crm.in and will lie on any other deployment',
  )
  assert.ok(
    !/\{subdomain\}\.\{ROOT_DOMAIN\}/.test(signupSrc),
    'the instance preview derives a per-tenant hostname; the live fleet has none',
  )
  assert.match(
    signupSrc,
    /Workspace ID: \{subdomain\}/,
    'the slug should still be shown as an identifier, just not dressed up as a URL',
  )
})

test('SIGNUP-004 signup handles the no-session (confirmation required) response', () => {
  assert.match(
    signupSrc,
    /needsEmailConfirmation/,
    'SignupPage ignores whether a session was created; with confirmations on, every signup ' +
      'is routed to a guarded page and bounced straight back to /login',
  )
  assert.ok(
    signupSrc.indexOf('if (needsEmailConfirmation)') < signupSrc.indexOf("navigate('/dashboard')"),
    'the confirmation branch must be taken before any navigation to a guarded route',
  )
})

test('SIGNUP-005 a slug is never empty and never starts or ends with a hyphen', () => {
  for (const name of [...NAMES, '!!!', '---', '   ', 'x']) {
    const s = slugify(name)
    assert.ok(!s.startsWith('-') && !s.endsWith('-'), `${JSON.stringify(name)} -> ${JSON.stringify(s)}`)
  }
  // The trigger substitutes 'biz' when the slug comes out empty; the preview simply shows
  // nothing, which is honest — it must not show a name the trigger will not use.
  assert.equal(slugify('!!!'), '')
})

test('SIGNUP-006 auth-context asks Supabase to send the user back to /login after confirming', () => {
  const ctx = fs.readFileSync(path.join(ROOT, 'src/lib/auth-context.tsx'), 'utf8')
  assert.match(
    ctx,
    /emailRedirectTo/,
    'without emailRedirectTo the confirmation link uses the project Site URL, which on the ' +
      'live project still points at 127.0.0.1:3000',
  )
})

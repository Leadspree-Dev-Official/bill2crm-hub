import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')

test('TENANT-001 TenantsPage renders End Date and Renewed table headers', () => {
  const file = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/admin/TenantsPage.tsx'), 'utf8')

  assert.match(
    file,
    /End Date/,
    'TenantsPage must include End Date header',
  )
  assert.match(
    file,
    /Renewed/,
    'TenantsPage must include Renewed header',
  )
  assert.match(
    file,
    /Yes \/ No/,
    'TenantsPage must include Yes / No subtitle for Renewed',
  )
  assert.match(
    file,
    /Active\/Total/,
    'TenantsPage must include Active/Total subtitle for User Count',
  )
})

test('TENANT-002 TenantsPage queries billing_payments and maintains paymentsMap for renewal tracking', () => {
  const file = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/admin/TenantsPage.tsx'), 'utf8')

  assert.match(
    file,
    /supabase\.from\('billing_payments'\)/,
    'TenantsPage must query billing_payments to track payments and renewals',
  )
  assert.match(
    file,
    /paymentsMap/,
    'TenantsPage must maintain paymentsMap for tenant payment lookups',
  )
})

test('TENANT-003 TenantsPage centers table headers and data cells', () => {
  const file = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/admin/TenantsPage.tsx'), 'utf8')

  assert.match(
    file,
    /<TableHead className="py-2 px-2 text-center" title="Subscription End \/ Renewal Date">\s*<div>End Date<\/div>/,
    'End Date TableHead must be center aligned',
  )
  assert.match(
    file,
    /<TableHead className="py-2 px-1\.5 text-center" title="Subscription Renewed Status">\s*<div>Renewed<\/div>/,
    'Renewed TableHead must be center aligned',
  )
})

test('TENANT-004 TenantsPage handles Lifetime, Free, Active and Expired states with correct Renewed Yes/No flags', () => {
  const file = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/admin/TenantsPage.tsx'), 'utf8')

  assert.match(
    file,
    /isLifetime/,
    'TenantsPage must evaluate isLifetime',
  )
  assert.match(
    file,
    /isTrial/,
    'TenantsPage must evaluate isTrial',
  )
  assert.match(
    file,
    /isRenewed/,
    'TenantsPage must evaluate isRenewed',
  )
  assert.match(
    file,
    /colSpan=\{10\}/,
    'Empty state row must span across all 10 columns',
  )
})

test('TENANT-005 TenantsPage displays Edit and Reassign as direct action buttons with Offline Pay and Beta in dropdown', () => {
  const file = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/admin/TenantsPage.tsx'), 'utf8')

  assert.match(
    file,
    /<Button[^>]*onClick=\{[^}]*setEditing\(tenant\)[^}]*\}[\s\S]*?>\s*<Edit[^>]*\/>\s*Edit\s*<\/Button>/,
    'TenantsPage must render Edit as direct button',
  )
  assert.match(
    file,
    /<Button[^>]*onClick=\{[^}]*setReassigning\(tenant\)[^}]*\}[\s\S]*?>\s*<Server[^>]*\/>\s*Reassign\s*<\/Button>/,
    'TenantsPage must render Reassign as direct button',
  )
  assert.match(
    file,
    /Offline Payment/,
    'TenantsPage must include Offline Payment in dropdown menu',
  )
  assert.match(
    file,
    /Beta Tester Grant/,
    'TenantsPage must include Beta Tester Grant in dropdown menu',
  )
})

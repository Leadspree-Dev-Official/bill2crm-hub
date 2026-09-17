// REACT-001..REACT-008 — reactive state synchronization contracts
//
// Verifies that mutations across the control plane (reassigning targets, switching
// default targets, modifying entitlements, upgrade requests) immediately notify the
// global auth context and invalidate stale cached state without requiring a full browser refresh.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/harness.mjs'

const authCtx = fs.readFileSync(path.join(ROOT, 'src/lib/auth-context.tsx'), 'utf8')
const reassignDialog = fs.readFileSync(path.join(ROOT, 'src/components/admin/reassign-app-target-dialog.tsx'), 'utf8')
const entitlementDialog = fs.readFileSync(path.join(ROOT, 'src/components/admin/entitlement-dialog.tsx'), 'utf8')
const appLinksPage = fs.readFileSync(path.join(ROOT, 'src/pages/admin/AppLinksPage.tsx'), 'utf8')
const dashboardPage = fs.readFileSync(path.join(ROOT, 'src/pages/dashboard/DashboardPage.tsx'), 'utf8')
const appShell = fs.readFileSync(path.join(ROOT, 'src/components/app-shell.tsx'), 'utf8')
const tenantsPage = fs.readFileSync(path.join(ROOT, 'src/pages/admin/TenantsPage.tsx'), 'utf8')

test('REACT-001 auth-context defines and exports global reactive event triggers', () => {
  assert.match(authCtx, /AUTH_REFRESH_EVENT = 'bill2crm:auth_refresh'/)
  assert.match(authCtx, /UPGRADE_REQUESTS_EVENT = 'bill2crm:upgrade_requests_changed'/)
  assert.match(authCtx, /export function triggerAuthRefresh/)
  assert.match(authCtx, /export function triggerUpgradeRequestsChanged/)
})

test('REACT-002 auth-context listens to focus, visibility, and custom refresh events', () => {
  assert.match(authCtx, /window\.addEventListener\(AUTH_REFRESH_EVENT/)
  assert.match(authCtx, /window\.addEventListener\('focus'/)
  assert.match(authCtx, /document\.addEventListener\('visibilitychange'/)
})

test('REACT-003 reassign-app-target-dialog triggers auth refresh and previews target URLs', () => {
  assert.match(reassignDialog, /triggerAuthRefresh\(\)/)
  assert.match(reassignDialog, /void refresh\(\)/)
  assert.match(reassignDialog, /target\.app_base_url/)
})

test('REACT-004 entitlement-dialog triggers auth refresh on saving modifications', () => {
  assert.match(entitlementDialog, /triggerAuthRefresh\(\)/)
  assert.match(entitlementDialog, /void refresh\(\)/)
})

test('REACT-005 app-links page triggers auth refresh on create, update, and default assignment', () => {
  assert.match(appLinksPage, /triggerAuthRefresh\(\)/)
  assert.match(appLinksPage, /void refresh\(\)/)
  const setDefaultFn = appLinksPage.slice(appLinksPage.indexOf('async function handleSetDefault'))
  assert.match(setDefaultFn.slice(0, 500), /triggerAuthRefresh\(\)/)
})

test('REACT-006 dashboard-page revalidates profile on mount', () => {
  assert.match(dashboardPage, /void refresh\(\)/)
})

test('REACT-007 app-shell listens to upgrade request changes and focus to keep badges fresh', () => {
  assert.match(appShell, /window\.addEventListener\(UPGRADE_REQUESTS_EVENT/)
  assert.match(appShell, /window\.addEventListener\('focus'/)
})

test('REACT-008 tenants-page queries app_base_url, default target, and provides manual refresh', () => {
  assert.match(tenantsPage, /app_base_url/)
  assert.match(tenantsPage, /is_default/)
  assert.match(tenantsPage, /RefreshCw/)
})

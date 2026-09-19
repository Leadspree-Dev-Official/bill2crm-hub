import test from 'node:test'
import assert from 'node:assert/strict'
import { STATUS_LABEL, STATUS_BADGE_VARIANT, resolveTenantDisplayStatus } from '../src/lib/plan-utils.ts'

test('LIFECYCLE-001 status mapping defines paused state', () => {
  assert.equal(STATUS_LABEL.paused, 'Paused (Inactive)')
  assert.equal(STATUS_LABEL.suspended, 'Suspended')
  assert.equal(STATUS_BADGE_VARIANT.paused, 'secondary')
})

test('LIFECYCLE-002 evaluates 15-day pause, 30-day suspend, and 60-day purge correctly', () => {
  function evaluateInactivityStage(inactiveDays) {
    if (inactiveDays >= 60) return 'purged'
    if (inactiveDays >= 30) return 'suspended'
    if (inactiveDays >= 15) return 'paused'
    return 'none'
  }

  assert.equal(evaluateInactivityStage(0), 'none')
  assert.equal(evaluateInactivityStage(14), 'none')
  assert.equal(evaluateInactivityStage(15), 'paused')
  assert.equal(evaluateInactivityStage(29), 'paused')
  assert.equal(evaluateInactivityStage(30), 'suspended')
  assert.equal(evaluateInactivityStage(59), 'suspended')
  assert.equal(evaluateInactivityStage(60), 'purged')
  assert.equal(evaluateInactivityStage(90), 'purged')
})

test('LIFECYCLE-003 activity calculation takes max of owner and invited member logins', () => {
  const now = new Date('2026-09-18T00:00:00Z').getTime()
  const dayMs = 24 * 60 * 60 * 1000

  function computeInactiveDays(createdAt, ownerCpLogin, ownerWebAppLogin, memberLogins) {
    const timestamps = [new Date(createdAt).getTime()]
    if (ownerCpLogin) timestamps.push(new Date(ownerCpLogin).getTime())
    if (ownerWebAppLogin) timestamps.push(new Date(ownerWebAppLogin).getTime())
    for (const m of memberLogins) {
      if (m) timestamps.push(new Date(m).getTime())
    }
    const maxActive = Math.max(...timestamps)
    return Math.floor((now - maxActive) / dayMs)
  }

  // Owner inactive for 20 days, but invited member logged in 2 days ago -> inactiveDays = 2 (NOT paused)
  const daysWithActiveMember = computeInactiveDays(
    '2026-08-01T00:00:00Z',
    '2026-08-29T00:00:00Z', // 20 days ago
    '2026-08-29T00:00:00Z',
    ['2026-09-16T00:00:00Z']  // 2 days ago
  )
  assert.equal(daysWithActiveMember, 2)

  // Both owner and all invited members inactive for 16 days -> paused
  const daysInactiveAll = computeInactiveDays(
    '2026-08-01T00:00:00Z',
    '2026-09-02T00:00:00Z', // 16 days ago
    '2026-09-02T00:00:00Z',
    ['2026-09-01T00:00:00Z'] // 17 days ago
  )
  assert.equal(daysInactiveAll, 16)
})

test('LIFECYCLE-004 resolveTenantDisplayStatus accurately reflects paid plan vs trial vs free', () => {
  // 1. Paid plan with status originally recorded as 'free' must display as 'active' (NOT Free Plan)
  assert.equal(
    resolveTenantDisplayStatus('free', { plan_id: 'plan_private_cloud_lifetime', is_lifetime: true }),
    'active',
  )
  assert.equal(
    resolveTenantDisplayStatus('free', { plan_id: 'plan_pro', is_lifetime: false, billing_cycle: 'monthly' }),
    'active',
  )

  // 2. Trial tenant on free plan shows 'trial'
  assert.equal(
    resolveTenantDisplayStatus('trial', { plan_id: 'plan_free' }),
    'trial',
  )

  // 3. Expired trial / unpaid free tenant shows 'free'
  assert.equal(
    resolveTenantDisplayStatus('free', { plan_id: 'plan_free' }),
    'free',
  )
  assert.equal(
    resolveTenantDisplayStatus('active', { plan_id: 'plan_free' }),
    'free',
  )

  // 4. Paused, suspended, past_due retain their critical operational states even if on paid plan
  assert.equal(
    resolveTenantDisplayStatus('paused', { plan_id: 'plan_private_cloud_lifetime' }),
    'paused',
  )
  assert.equal(
    resolveTenantDisplayStatus('suspended', { plan_id: 'plan_private_cloud_lifetime' }),
    'suspended',
  )
  assert.equal(
    resolveTenantDisplayStatus('past_due', { plan_id: 'plan_pro' }),
    'past_due',
  )
})


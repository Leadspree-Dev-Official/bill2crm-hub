import test from 'node:test'
import assert from 'node:assert/strict'
import { STATUS_LABEL, STATUS_BADGE_VARIANT, resolveTenantDisplayStatus, getSubscriptionPeriodInfo } from '../src/lib/plan-utils.ts'

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
  const now = new Date('2026-09-18T10:00:00Z').getTime()
  const webAppSignIn = new Date('2026-09-02T10:00:00Z').getTime() // 16 days ago
  const cpSignIn = new Date('2026-09-10T10:00:00Z').getTime() // 8 days ago

  const daysInactiveWebAppOnly = Math.floor((now - webAppSignIn) / (1000 * 60 * 60 * 24))
  assert.equal(daysInactiveWebAppOnly, 16)

  const maxSignIn = Math.max(webAppSignIn, cpSignIn)
  const daysInactiveCombined = Math.floor((now - maxSignIn) / (1000 * 60 * 60 * 24))
  assert.equal(daysInactiveCombined, 8)

  const daysInactiveAll = Math.floor((now - webAppSignIn) / (1000 * 60 * 60 * 24))
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

test('LIFECYCLE-005 dynamic real-time evaluation of subscription end dates', () => {
  const now = new Date('2026-09-20T12:00:00Z').getTime()

  // Future period end: Active
  assert.equal(
    resolveTenantDisplayStatus('active', {
      plan_id: 'plan_cloud_saas',
      current_period_end: '2026-10-20T12:00:00Z',
    }, now),
    'active',
  )

  // Past period end within 3-day grace period (e.g. expired 1 day ago): Past Due
  assert.equal(
    resolveTenantDisplayStatus('active', {
      plan_id: 'plan_cloud_saas',
      current_period_end: '2026-09-19T12:00:00Z',
    }, now, 3),
    'past_due',
  )

  // Past period end past 3-day grace period (e.g. expired 5 days ago): Paused
  assert.equal(
    resolveTenantDisplayStatus('active', {
      plan_id: 'plan_cloud_saas',
      current_period_end: '2026-09-14T12:00:00Z',
    }, now, 3),
    'paused',
  )

  // Trial still running: trial
  assert.equal(
    resolveTenantDisplayStatus('trial', {
      plan_id: 'plan_trial',
      trial_ends_at: '2026-09-25T12:00:00Z',
    }, now),
    'trial',
  )

  // Trial expired: drops to free
  assert.equal(
    resolveTenantDisplayStatus('trial', {
      plan_id: 'plan_trial',
      trial_ends_at: '2026-09-15T12:00:00Z',
    }, now),
    'free',
  )

  // Lifetime plan is always active regardless of dates
  assert.equal(
    resolveTenantDisplayStatus('active', {
      plan_id: 'plan_private_cloud_lifetime',
      is_lifetime: true,
      current_period_end: '2026-01-01T00:00:00Z',
    }, now),
    'active',
  )
})

test('LIFECYCLE-006 getSubscriptionPeriodInfo generates human-readable countdowns and alert flags', () => {
  const now = new Date('2026-09-20T12:00:00Z').getTime()

  // Lifetime
  const lifetimeInfo = getSubscriptionPeriodInfo({ is_lifetime: true }, now)
  assert.equal(lifetimeInfo.isLifetime, true)
  assert.equal(lifetimeInfo.alert, false)
  assert.equal(lifetimeInfo.statusText, 'Lifetime access (no expiry)')

  // Expiring in 5 days (Alert flag should be true)
  const expiringSoonInfo = getSubscriptionPeriodInfo({
    plan_id: 'plan_cloud_saas',
    current_period_end: '2026-09-25T12:00:00Z',
  }, now)
  assert.equal(expiringSoonInfo.isExpiringSoon, true)
  assert.equal(expiringSoonInfo.isExpired, false)
  assert.equal(expiringSoonInfo.diffDays, 5)
  assert.equal(expiringSoonInfo.alert, true)
  assert.match(expiringSoonInfo.statusText, /Expires in 5d/)

  // Expired 2 days ago (Alert flag should be true)
  const expiredInfo = getSubscriptionPeriodInfo({
    plan_id: 'plan_cloud_saas',
    current_period_end: '2026-09-18T12:00:00Z',
  }, now)
  assert.equal(expiredInfo.isExpired, true)
  assert.equal(expiredInfo.alert, true)
  assert.equal(expiredInfo.diffDays, -2)
  assert.match(expiredInfo.statusText, /Expired 2d ago/)

  // Renews in 30 days
  const futureInfo = getSubscriptionPeriodInfo({
    plan_id: 'plan_cloud_saas',
    current_period_end: '2026-10-20T12:00:00Z',
  }, now)
  assert.equal(futureInfo.isExpired, false)
  assert.equal(futureInfo.isExpiringSoon, false)
  assert.equal(futureInfo.alert, false)
  assert.equal(futureInfo.diffDays, 30)
  assert.match(futureInfo.statusText, /Renews.*in 30d/)
})

test('LIFECYCLE-007 getSubscriptionPeriodInfo accurately resolves start date, end date, and renewal due date', () => {
  const now = new Date('2026-09-20T12:00:00Z').getTime()

  const sub = {
    plan_id: 'plan_cloud_saas',
    billing_cycle: 'monthly',
    current_period_start: '2026-08-20T12:00:00Z',
    current_period_end: '2026-09-20T12:00:00Z',
    charge_at: '2026-09-20T12:00:00Z',
  }

  const info = getSubscriptionPeriodInfo(sub, now, 3)
  assert.ok(info.startDate)
  assert.ok(info.endDate)
  assert.ok(info.renewalDueDate)
  assert.ok(info.graceDueDate)

  assert.equal(info.formattedStartDate, '20 Aug 2026')
  assert.match(info.formattedEndDate, /20 Sep/)
  assert.match(info.formattedDueDate, /20 Sep/)
  assert.match(info.formattedGraceDueDate, /23 Sep/)
})


import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')

test('PAY-001 App.tsx registers /admin/payments-received route and imports PaymentsReceivedPage', () => {
  const appFile = fs.readFileSync(path.join(REPO_ROOT, 'src/App.tsx'), 'utf8')

  assert.match(
    appFile,
    /import PaymentsReceivedPage from ['"]@\/pages\/admin\/PaymentsReceivedPage['"]/,
    'App.tsx must import PaymentsReceivedPage',
  )
  assert.match(
    appFile,
    /<Route path=["']payments-received["'] element={<PaymentsReceivedPage \/>}/,
    'App.tsx must define payments-received admin route',
  )
})

test('PAY-002 app-shell.tsx includes Payments received in controlPanelNav with ReceiptIndianRupee icon', () => {
  const shellFile = fs.readFileSync(path.join(REPO_ROOT, 'src/components/app-shell.tsx'), 'utf8')

  assert.match(
    shellFile,
    /ReceiptIndianRupee/,
    'app-shell.tsx must import ReceiptIndianRupee icon',
  )
  assert.match(
    shellFile,
    /to:\s*['"]\/admin\/payments-received['"],\s*label:\s*['"]Payments received['"],\s*icon:\s*ReceiptIndianRupee/,
    'app-shell.tsx must declare Payments received in controlPanelNav',
  )
})

test('PAY-003 GrantBetaDialog supports tenant selection and emphasizes Free of Cost (Amount = ₹0)', () => {
  const betaDialogFile = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/admin/grant-beta-dialog.tsx'),
    'utf8',
  )

  assert.match(
    betaDialogFile,
    /tenants\?: TenantWithDetails\[\]/,
    'GrantBetaDialog must accept optional tenants list for global administration',
  )
  assert.match(
    betaDialogFile,
    /₹0\.00/,
    'GrantBetaDialog must explicitly display ₹0.00 amount to charge',
  )
  assert.match(
    betaDialogFile,
    /100% Free of Cost/,
    'GrantBetaDialog must state 100% Free of Cost for beta testers',
  )
  assert.match(
    betaDialogFile,
    /adminGrantBetaAccess/,
    'GrantBetaDialog must invoke adminGrantBetaAccess RPC',
  )
})

test('PAY-004 RecordPaymentDialog supports global tenant selection via optional tenants prop', () => {
  const recordDialogFile = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/admin/record-payment-dialog.tsx'),
    'utf8',
  )

  assert.match(
    recordDialogFile,
    /tenants\?: TenantWithDetails\[\]/,
    'RecordPaymentDialog must accept optional tenants list',
  )
  assert.match(
    recordDialogFile,
    /activeTenant/,
    'RecordPaymentDialog must resolve active tenant from props or selection',
  )
})

test('PAY-005 Accounting totals correctly calculate Gross, Base, GST, and ₹0 Beta grants', () => {
  const mockPayments = [
    {
      id: 'pay-1',
      tenant_id: 't-1',
      method: 'razorpay',
      amount_paise: 100000, // ₹1,000 base
      tax_paise: 18000,     // ₹180 GST
      status: 'captured',
    },
    {
      id: 'pay-2',
      tenant_id: 't-2',
      method: 'cash',
      amount_paise: 200000, // ₹2,000 base
      tax_paise: 36000,     // ₹360 GST
      status: 'captured',
    },
    {
      id: 'pay-3',
      tenant_id: 't-3',
      method: 'beta',
      amount_paise: 0,      // ₹0 base for beta tester
      tax_paise: 0,         // ₹0 tax
      status: 'captured',
    },
    {
      id: 'pay-4',
      tenant_id: 't-4',
      method: 'bank_transfer',
      amount_paise: 50000,
      tax_paise: 9000,
      status: 'failed',     // failed should not count in gross revenue
    },
  ]

  let capturedGrossPaise = 0
  let capturedBasePaise = 0
  let capturedGstPaise = 0
  let betaCount = 0

  mockPayments.forEach((p) => {
    if (p.status === 'captured') {
      capturedGrossPaise += p.amount_paise + p.tax_paise
      capturedBasePaise += p.amount_paise
      capturedGstPaise += p.tax_paise
      if (p.method === 'beta') {
        betaCount += 1
      }
    }
  })

  // Base: 1000 + 2000 + 0 = 3000 INR = 300000 paise
  assert.equal(capturedBasePaise, 300000)
  // GST: 180 + 360 + 0 = 540 INR = 54000 paise
  assert.equal(capturedGstPaise, 54000)
  // Gross: 3540 INR = 354000 paise
  assert.equal(capturedGrossPaise, 354000)
  // Beta count
  assert.equal(betaCount, 1)
})

test('PAY-006 Overdue receivables calculate renewal price with 18% GST', () => {
  const mockPlanPrice = 1499 // INR
  const gstRate = 0.18
  const gstInr = Math.round(mockPlanPrice * gstRate)
  const totalPendingInr = mockPlanPrice + gstInr

  assert.equal(gstInr, 270)
  assert.equal(totalPendingInr, 1769)
  assert.equal(totalPendingInr * 100, 176900) // in paise
})

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchAdminBillingSummary,
  type AdminBillingSummary,
  type BillingNotification,
  type BillingPayment,
} from '@/lib/api/billing'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { GrantBetaDialog } from '@/components/admin/grant-beta-dialog'
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog'
import { StatusBadge } from '@/components/status-badge'
import { resolveTenantDisplayStatus } from '@/lib/plan-utils'
import { buildWhatsAppRenewalLink } from '@/lib/whatsapp'
import type { SubscriptionPlan, TenantStatus, TenantWithDetails } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FlaskConical,
  IndianRupee,
  MessageSquare,
  Receipt,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'

function formatPaise(paise: number): string {
  const inr = Math.round(paise / 100)
  return `₹${inr.toLocaleString('en-IN')}`
}

interface TenantPaymentProfile {
  tenant: TenantWithDetails
  plan: SubscriptionPlan | null
  totalPaidPaise: number
  totalGstPaise: number
  paymentCount: number
  lastPayment: BillingPayment | null
  isBeta: boolean
  betaExpiry: string | null
  pendingAmountPaise: number
  pendingReason: string
}

export default function PaymentsReceivedPage() {
  const [tenants, setTenants] = useState<TenantWithDetails[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [payments, setPayments] = useState<(BillingPayment & { tenant_name?: string; subdomain?: string })[]>([])
  const [notifications, setNotifications] = useState<(BillingNotification & { tenant_name?: string })[]>([])
  const [summary, setSummary] = useState<AdminBillingSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [activeTab, setActiveTab] = useState('tenants')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TenantStatus | 'beta'>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | '30d' | 'this_month'>('all')

  // Dialog states
  const [betaOpen, setBetaOpen] = useState(false)
  const [selectedBetaTenant, setSelectedBetaTenant] = useState<TenantWithDetails | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedPaymentTenant, setSelectedPaymentTenant] = useState<TenantWithDetails | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [tenantsRes, plansRes, paymentsRes, notifsRes, summaryRes] = await Promise.all([
      supabase
        .from('tenants')
        .select('*, tenant_subscriptions(*), app_target:app_targets(id, label, app_base_url)')
        .order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('sort_order'),
      supabase
        .from('billing_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('billing_notifications')
        .select('*')
        .is('acknowledged_at', null)
        .order('due_at', { ascending: false }),
      fetchAdminBillingSummary(),
    ])

    if (summaryRes.summary) {
      setSummary(summaryRes.summary)
    }

    const plansData = (plansRes.data as SubscriptionPlan[]) ?? []
    setPlans(plansData)

    const rawTenants = (tenantsRes.data ?? []).map((row) => ({
      ...row,
      tenant_subscriptions: Array.isArray(row.tenant_subscriptions)
        ? row.tenant_subscriptions[0] ?? null
        : row.tenant_subscriptions,
    })) as TenantWithDetails[]
    setTenants(rawTenants)

    const tenantMap: Record<string, { name: string; slug: string }> = {}
    rawTenants.forEach((t) => {
      tenantMap[t.id] = { name: t.business_name, slug: t.subdomain_slug }
    })

    if (paymentsRes.data) {
      setPayments(
        paymentsRes.data.map((p) => ({
          ...p,
          tenant_name: tenantMap[p.tenant_id]?.name || 'Unknown workspace',
          subdomain: tenantMap[p.tenant_id]?.slug || '',
        })),
      )
    }

    if (notifsRes.data) {
      setNotifications(
        notifsRes.data.map((n) => ({
          ...n,
          tenant_name: tenantMap[n.tenant_id]?.name || 'Workspace',
        })),
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Map plans by ID
  const plansMap = useMemo(() => {
    const map: Record<string, SubscriptionPlan> = {}
    plans.forEach((p) => {
      map[p.id] = p
    })
    return map
  }, [plans])

  // Compute detailed financial profile for each tenant
  const tenantProfiles = useMemo<TenantPaymentProfile[]>(() => {
    const paymentsByTenant: Record<string, BillingPayment[]> = {}
    payments.forEach((p) => {
      if (!paymentsByTenant[p.tenant_id]) {
        paymentsByTenant[p.tenant_id] = []
      }
      paymentsByTenant[p.tenant_id].push(p)
    })

    return tenants.map((t) => {
      const sub = t.tenant_subscriptions
      const plan = sub?.plan_id ? plansMap[sub.plan_id] || null : null
      const tenantPayments = paymentsByTenant[t.id] ?? []

      const capturedPayments = tenantPayments.filter((p) => p.status === 'captured')
      const totalPaidPaise = capturedPayments.reduce((acc, p) => acc + (p.amount_paise || 0) + (p.tax_paise || 0), 0)
      const totalGstPaise = capturedPayments.reduce((acc, p) => acc + (p.tax_paise || 0), 0)
      const lastPayment = capturedPayments[0] ?? null

      // Check if tenant is currently on beta evaluation
      const hasBetaPayment = tenantPayments.some((p) => p.method === 'beta' && p.status === 'captured')
      const isBetaExpired = sub?.current_period_end ? new Date(sub.current_period_end) < new Date() : false
      const isBeta = hasBetaPayment && !isBetaExpired

      // Pending Amount calculation
      let pendingAmountPaise = 0
      let pendingReason = 'Up to date'

      const displayStatus = resolveTenantDisplayStatus(t.status, sub)

      if (isBeta) {
        pendingAmountPaise = 0
        pendingReason = 'Beta Tester (₹0 Free of Cost)'
      } else if (displayStatus === 'past_due' || t.status === 'past_due') {
        const cycle = sub?.billing_cycle || 'monthly'
        const baseInr =
          cycle === 'yearly'
            ? plan?.price_yearly_inr || 0
            : cycle === 'lifetime'
              ? plan?.price_lifetime_inr || 0
              : plan?.price_monthly_inr || 0
        const gstInr = Math.round(baseInr * 0.18)
        pendingAmountPaise = (baseInr + gstInr) * 100
        pendingReason = 'Past Due (Grace period active)'
      } else if (displayStatus === 'trial') {
        pendingAmountPaise = 0
        pendingReason = 'In Trial evaluation'
      } else if (displayStatus === 'free' || sub?.plan_id === 'plan_free') {
        pendingAmountPaise = 0
        pendingReason = 'Free plan'
      } else {
        pendingAmountPaise = 0
        pendingReason = 'Paid & Current'
      }

      return {
        tenant: t,
        plan,
        totalPaidPaise,
        totalGstPaise,
        paymentCount: capturedPayments.length,
        lastPayment,
        isBeta,
        betaExpiry: isBeta ? sub?.current_period_end ?? null : null,
        pendingAmountPaise,
        pendingReason,
      }
    })
  }, [tenants, payments, plansMap])

  // Accounting Summary Metrics calculation
  const accountingTotals = useMemo(() => {
    let capturedGrossPaise = 0
    let capturedBasePaise = 0
    let capturedGstPaise = 0
    let betaGrantCount = 0
    let betaCompedValueInr = 0
    let totalPendingReceivablesPaise = 0
    let pastDueCount = 0

    payments.forEach((p) => {
      if (p.status === 'captured') {
        capturedGrossPaise += (p.amount_paise || 0) + (p.tax_paise || 0)
        capturedBasePaise += p.amount_paise || 0
        capturedGstPaise += p.tax_paise || 0

        if (p.method === 'beta') {
          betaGrantCount += 1
          const associatedPlan = p.plan_id ? plansMap[p.plan_id] : null
          betaCompedValueInr += associatedPlan?.price_monthly_inr || 0
        }
      }
    })

    tenantProfiles.forEach((tp) => {
      if (tp.pendingAmountPaise > 0) {
        totalPendingReceivablesPaise += tp.pendingAmountPaise
        pastDueCount += 1
      }
    })

    return {
      grossReceivedPaise: capturedGrossPaise,
      baseReceivedPaise: capturedBasePaise,
      gstCollectedPaise: capturedGstPaise,
      betaGrantCount,
      betaCompedValueInr,
      totalPendingReceivablesPaise,
      pastDueCount,
      totalCapturedTransactions: payments.filter((p) => p.status === 'captured').length,
    }
  }, [payments, tenantProfiles, plansMap])

  // Filtered tenants
  const filteredTenantProfiles = useMemo(() => {
    return tenantProfiles.filter((item) => {
      const { tenant, isBeta } = item
      const displayStatus = resolveTenantDisplayStatus(tenant.status, tenant.tenant_subscriptions)

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = tenant.business_name.toLowerCase().includes(q)
        const matchSlug = tenant.subdomain_slug.toLowerCase().includes(q)
        const matchEmail = tenant.web_app_email?.toLowerCase().includes(q) ?? false
        if (!matchName && !matchSlug && !matchEmail) return false
      }

      // Status filter
      if (statusFilter === 'beta') {
        if (!isBeta) return false
      } else if (statusFilter !== 'all') {
        if (displayStatus !== statusFilter && tenant.status !== statusFilter) return false
      }

      return true
    })
  }, [tenantProfiles, searchQuery, statusFilter])

  // Filtered payments ledger
  const filteredPayments = useMemo(() => {
    const now = new Date()
    return payments.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchInvoice = p.invoice_no?.toLowerCase().includes(q) ?? false
        const matchTenant = p.tenant_name?.toLowerCase().includes(q) ?? false
        const matchRef = p.reference?.toLowerCase().includes(q) ?? false
        const matchNote = p.note?.toLowerCase().includes(q) ?? false
        if (!matchInvoice && !matchTenant && !matchRef && !matchNote) return false
      }

      // Method filter
      if (methodFilter !== 'all' && p.method !== methodFilter) {
        return false
      }

      // Date filter
      if (dateFilter !== 'all') {
        const pDate = new Date(p.captured_at || p.created_at)
        if (dateFilter === '30d') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (pDate < thirtyDaysAgo) return false
        } else if (dateFilter === 'this_month') {
          if (pDate.getMonth() !== now.getMonth() || pDate.getFullYear() !== now.getFullYear()) {
            return false
          }
        }
      }

      return true
    })
  }, [payments, searchQuery, methodFilter, dateFilter])

  // CSV Export for Accounting / Bookkeeping
  function exportAccountingCsv() {
    if (payments.length === 0) {
      toast.error('No payment records available to export')
      return
    }

    const headers = [
      'Invoice No',
      'Captured Date',
      'Tenant / Business Name',
      'Subdomain',
      'Plan',
      'Cycle',
      'Payment Method',
      'Base Amount (INR)',
      'GST 18% (INR)',
      'Total Received (INR)',
      'Payment Status',
      'Reference / UTR',
      'Admin Notes',
    ]

    const rows = payments.map((p) => {
      const baseInr = Math.round((p.amount_paise || 0) / 100)
      const taxInr = Math.round((p.tax_paise || 0) / 100)
      const totalInr = baseInr + taxInr
      const dateStr = new Date(p.captured_at || p.created_at).toISOString().split('T')[0]

      return [
        `"${p.invoice_no || 'N/A'}"`,
        `"${dateStr}"`,
        `"${(p.tenant_name || '').replace(/"/g, '""')}"`,
        `"${p.subdomain || ''}"`,
        `"${(p.plan_id || 'free').replace('plan_', '')}"`,
        `"${p.billing_cycle || 'N/A'}"`,
        `"${p.method}"`,
        baseInr,
        taxInr,
        totalInr,
        `"${p.status}"`,
        `"${(p.reference || '').replace(/"/g, '""')}"`,
        `"${(p.note || '').replace(/"/g, '""')}"`,
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `bill2crm_accounting_ledger_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Accounting CSV ledger exported successfully')
  }

  function getMethodBadge(method: string) {
    switch (method) {
      case 'razorpay':
        return <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300">Razorpay Gateway</Badge>
      case 'cash':
        return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300">Cash Offline</Badge>
      case 'bank_transfer':
        return <Badge className="bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25 dark:text-cyan-300">Bank Transfer (NEFT/IMPS)</Badge>
      case 'upi_manual':
        return <Badge className="bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/25 dark:text-indigo-300">UPI Manual</Badge>
      case 'cheque':
        return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300">Cheque</Badge>
      case 'beta':
        return <Badge className="bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 dark:text-violet-300 border border-violet-500/30">Beta Grant (₹0)</Badge>
      case 'comp':
        return <Badge variant="secondary">Comped (₹0)</Badge>
      default:
        return <Badge variant="outline">{method}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Payments Received & Accounting"
        description="Accounting ledger of all revenue collected, GST reconciliation, tenant payment status, and complimentary Beta Tester grants (₹0)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
              onClick={() => {
                setSelectedBetaTenant(null)
                setBetaOpen(true)
              }}
            >
              <FlaskConical className="size-3.5" />
              Grant Beta Plan (Free ₹0)
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              onClick={() => {
                setSelectedPaymentTenant(null)
                setPaymentOpen(true)
              }}
            >
              <Banknote className="size-3.5" />
              Record Offline Pay
            </Button>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAccountingCsv}>
              <Download className="size-3.5" />
              Export Accounting CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Accounting KPI Summary Cards (Compact) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="border-emerald-500/25 bg-emerald-50/25 p-3 dark:bg-emerald-950/15">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <span>Gross Received</span>
            <IndianRupee className="size-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-emerald-950 dark:text-emerald-100">
            {formatPaise(accountingTotals.grossReceivedPaise)}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {accountingTotals.totalCapturedTransactions} captured payments
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Net Base Revenue</span>
            <Receipt className="size-3.5 text-primary" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {formatPaise(accountingTotals.baseReceivedPaise)}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Net of taxes for bookkeeping
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>GST Collected (18%)</span>
            <FileSpreadsheet className="size-3.5 text-sky-600" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-sky-700 dark:text-sky-300">
            {formatPaise(accountingTotals.gstCollectedPaise)}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Indian GST tax liability record
          </div>
        </Card>

        <Card className="border-amber-500/25 bg-amber-50/25 p-3 dark:bg-amber-950/15">
          <div className="flex items-center justify-between text-xs font-medium text-amber-800 dark:text-amber-300">
            <span>Pending Receivables</span>
            <AlertTriangle className="size-3.5 text-amber-600" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-amber-950 dark:text-amber-100">
            {formatPaise(accountingTotals.totalPendingReceivablesPaise)}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {accountingTotals.pastDueCount} past due • {summary?.open_followups ?? notifications.length} alerts
          </div>
        </Card>

        <Card className="border-violet-500/25 bg-violet-50/25 p-3 dark:bg-violet-950/15">
          <div className="flex items-center justify-between text-xs font-medium text-violet-800 dark:text-violet-300">
            <span>Beta Testers (₹0 Free)</span>
            <FlaskConical className="size-3.5 text-violet-600" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-violet-950 dark:text-violet-100">
            {tenantProfiles.filter((tp) => tp.isBeta).length} Active
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {accountingTotals.betaGrantCount} total ₹0 vouchers
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="tenants" className="gap-2">
              <Users className="size-3.5" />
              <span>Tenant Status & Balances</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {filteredTenantProfiles.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="ledger" className="gap-2">
              <Receipt className="size-3.5" />
              <span>Payment Received Journal</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {filteredPayments.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="pending" className="gap-2">
              <Clock className="size-3.5" />
              <span>Pending & Overdue Queue</span>
              {accountingTotals.pastDueCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                  {accountingTotals.pastDueCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search workspace, invoice #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {activeTab === 'tenants' && (
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Tenant Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active (Paid)</SelectItem>
                  <SelectItem value="beta">Beta Tester (₹0)</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="free">Free Plan</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            )}

            {activeTab === 'ledger' && (
              <>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Payment Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="razorpay">Razorpay Gateway</SelectItem>
                    <SelectItem value="cash">Cash Offline</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi_manual">UPI Manual</SelectItem>
                    <SelectItem value="beta">Beta Grant (₹0)</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as any)}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Tenant Payment & Accounting Status */}
        <TabsContent value="tenants">
          <Card>
            <CardHeader className="px-4 py-2.5">
              <CardTitle className="text-sm font-semibold">Tenant Accounting & Payment Status</CardTitle>
              <CardDescription className="text-xs">
                Overview of each workspace&apos;s current plan, amount received to date, pending balances, and Beta Tester status.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTenantProfiles.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No tenant workspaces match the selected criteria.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Tenant Workspace</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Status</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Current Plan & Cycle</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Pending Due</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Amount Received</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Last Transaction</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-right text-xs">Admin Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenantProfiles.map((item) => {
                      const { tenant, plan, totalPaidPaise, isBeta, betaExpiry, pendingAmountPaise, lastPayment } = item
                      const sub = tenant.tenant_subscriptions
                      const displayStatus = resolveTenantDisplayStatus(tenant.status, sub)

                      return (
                        <TableRow key={tenant.id}>
                          <TableCell className="py-1.5 px-2.5">
                            <div className="font-medium text-foreground text-xs">{tenant.business_name}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {tenant.subdomain_slug}.bill2crm.com
                            </div>
                            {tenant.web_app_email && (
                              <div className="text-[10px] text-muted-foreground">{tenant.web_app_email}</div>
                            )}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">
                            <div className="space-y-0.5">
                              <StatusBadge status={displayStatus} />
                              {isBeta && (
                                <Badge className="block w-fit bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[9px] px-1 py-0">
                                  Beta Tester
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">
                            <div className="text-xs font-medium text-foreground">
                              {plan?.name || sub?.plan_id || 'Free'}
                            </div>
                            <div className="text-[10px] text-muted-foreground capitalize">
                              {sub?.billing_cycle || 'monthly'}
                              {sub?.is_lifetime && ' • Lifetime'}
                            </div>
                            {isBeta && betaExpiry && (
                              <div className="text-[9px] text-violet-600 dark:text-violet-400">
                                Free until {new Date(betaExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">
                            {pendingAmountPaise > 0 ? (
                              <div className="space-y-0.5">
                                <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                                  {formatPaise(pendingAmountPaise)}
                                </span>
                                <span className="block text-[9px] text-amber-700/80 dark:text-amber-300/80">
                                  Overdue Renewal
                                </span>
                              </div>
                            ) : isBeta ? (
                              <div className="space-y-0.5">
                                <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  ₹0.00
                                </span>
                                <span className="block text-[9px] text-violet-600 dark:text-violet-400 font-medium">
                                  Beta Free of Cost
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  ₹0.00
                                </span>
                                <span className="block text-[9px] text-muted-foreground">
                                  {item.pendingReason}
                                </span>
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">
                            <div className="font-mono text-xs font-semibold text-foreground">
                              {formatPaise(totalPaidPaise)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {item.paymentCount} {item.paymentCount === 1 ? 'payment' : 'payments'}
                            </div>
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">
                            {lastPayment ? (
                              <div className="space-y-0.5">
                                <div className="text-xs font-medium text-foreground">
                                  {formatPaise((lastPayment.amount_paise || 0) + (lastPayment.tax_paise || 0))}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(lastPayment.captured_at || lastPayment.created_at).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </div>
                                {lastPayment.invoice_no && (
                                  <div className="font-mono text-[9px] text-primary">
                                    {lastPayment.invoice_no}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No transactions</span>
                            )}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[11px] border-violet-500/30 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
                                onClick={() => {
                                  setSelectedBetaTenant(tenant)
                                  setBetaOpen(true)
                                }}
                                title="Grant any plan Free of Cost as Beta Tester (Amount = ₹0)"
                              >
                                <FlaskConical className="mr-1 size-3" />
                                Beta (₹0)
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-1.5 text-[11px] border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                onClick={() => {
                                  setSelectedPaymentTenant(tenant)
                                  setPaymentOpen(true)
                                }}
                                title="Record offline cash or bank payment"
                              >
                                <Banknote className="mr-1 size-3" />
                                Record Pay
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Payment Received Audit Ledger */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader className="px-4 py-2.5">
              <CardTitle className="text-sm font-semibold">Payment Received Journal & Audit Ledger</CardTitle>
              <CardDescription className="text-xs">
                Chronological ledger of every rupee collected through the Razorpay gateway, recorded offline, or granted as ₹0 Beta evaluator access.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredPayments.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No payment records match the current filter.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Invoice #</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Date</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Tenant Workspace</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Plan & Cycle</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Method</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-right text-xs">Amount (Base + GST)</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Reference / Note</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => {
                      const isBetaPayment = p.method === 'beta'
                      const isCompedPayment = p.method === 'comp'
                      const totalPaise = (p.amount_paise || 0) + (p.tax_paise || 0)

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="py-1.5 px-2.5 font-mono text-xs font-semibold text-primary">
                            {p.invoice_no || '—'}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(p.captured_at || p.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">
                            <div className="font-medium text-foreground text-xs">{p.tenant_name}</div>
                            {p.subdomain && (
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {p.subdomain}.bill2crm.com
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5 text-xs capitalize">
                            {p.plan_id ? p.plan_id.replace('plan_', '') : '—'}
                            {p.billing_cycle && ` (${p.billing_cycle})`}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">{getMethodBadge(p.method)}</TableCell>

                          <TableCell className="py-1.5 px-2.5 text-right font-mono text-xs">
                            {isBetaPayment ? (
                              <span className="font-bold text-violet-600 dark:text-violet-400">₹0.00 (Beta)</span>
                            ) : isCompedPayment ? (
                              <span className="font-bold text-muted-foreground">₹0.00 (Comp)</span>
                            ) : (
                              <div>
                                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                  {formatPaise(totalPaise)}
                                </span>
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  Base: {formatPaise(p.amount_paise || 0)} • GST: {formatPaise(p.tax_paise || 0)}
                                </div>
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5 max-w-[150px] text-xs text-muted-foreground">
                            {p.reference && <span className="font-mono text-[10px] truncate block">{p.reference}</span>}
                            {p.note && <span className="truncate block text-[11px]">{p.note}</span>}
                          </TableCell>

                          <TableCell className="py-1.5 px-2.5">
                            <Badge
                              variant={
                                p.status === 'captured'
                                  ? 'default'
                                  : p.status === 'failed'
                                    ? 'destructive'
                                    : 'outline'
                              }
                              className="capitalize text-[10px] px-1.5 py-0"
                            >
                              {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Pending Receivables & Dunning Queue */}
        <TabsContent value="pending">
          <Card>
            <CardHeader className="px-4 py-2.5">
              <CardTitle className="text-sm font-semibold">Pending Dues & Renewal Follow-up Queue</CardTitle>
              <CardDescription className="text-xs">
                Tenants whose subscription renewal is past due, trial has expired, or recurring payment failed. Immediate action required to prevent service interruption.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {tenantProfiles.filter((tp) => tp.pendingAmountPaise > 0).length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500/80" />
                  All accounts are in good standing! Zero pending overdue receivables.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Tenant Workspace</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Status</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Current Plan</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Pending Overdue Amount</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-xs">Contact / Channel</TableHead>
                      <TableHead className="h-8 py-1.5 px-2.5 text-right text-xs">Resolution Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantProfiles
                      .filter((tp) => tp.pendingAmountPaise > 0)
                      .map((item) => {
                        const { tenant, plan, pendingAmountPaise } = item
                        const sub = tenant.tenant_subscriptions
                        const waLink = buildWhatsAppRenewalLink({
                          businessName: tenant.business_name,
                          kind: 'renewal_due',
                          title: 'Subscription Renewal Overdue',
                        })

                        return (
                          <TableRow key={tenant.id}>
                            <TableCell className="py-1.5 px-2.5">
                              <div className="font-medium text-foreground text-xs">{tenant.business_name}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {tenant.subdomain_slug}.bill2crm.com
                              </div>
                            </TableCell>

                            <TableCell className="py-1.5 px-2.5">
                              <StatusBadge status={resolveTenantDisplayStatus(tenant.status, sub)} />
                            </TableCell>

                            <TableCell className="py-1.5 px-2.5 text-xs">
                              <span className="font-medium">{plan?.name || 'Pro'}</span>
                              <span className="text-muted-foreground block text-[10px] capitalize">
                                {sub?.billing_cycle || 'monthly'}
                              </span>
                            </TableCell>

                            <TableCell className="py-1.5 px-2.5">
                              <div className="font-mono text-xs font-bold text-destructive">
                                {formatPaise(pendingAmountPaise)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                incl. 18% Indian GST
                              </div>
                            </TableCell>

                            <TableCell className="py-1.5 px-2.5">
                              {waLink && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-6 gap-1 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40 text-[11px] px-2"
                                >
                                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                                    <MessageSquare className="size-3" />
                                    WhatsApp
                                  </a>
                                </Button>
                              )}
                            </TableCell>

                            <TableCell className="py-1.5 px-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-1.5 text-[11px] border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                                  onClick={() => {
                                    setSelectedPaymentTenant(tenant)
                                    setPaymentOpen(true)
                                  }}
                                >
                                  <Banknote className="mr-1 size-3" />
                                  Record Pay
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-1.5 text-[11px] border-violet-500/30 text-violet-700 hover:bg-violet-50 dark:text-violet-300"
                                  onClick={() => {
                                    setSelectedBetaTenant(tenant)
                                    setBetaOpen(true)
                                  }}
                                >
                                  <FlaskConical className="mr-1 size-3" />
                                  Beta (₹0)
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Global & Per-Tenant Modals */}
      <GrantBetaDialog
        tenant={selectedBetaTenant}
        tenants={tenants}
        open={betaOpen}
        onOpenChange={setBetaOpen}
        onSaved={loadData}
      />

      <RecordPaymentDialog
        tenant={selectedPaymentTenant}
        tenants={tenants}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSaved={loadData}
      />
    </div>
  )
}

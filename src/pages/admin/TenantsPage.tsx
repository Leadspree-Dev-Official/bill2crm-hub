import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchTenantsActivity, purgeTenant, resumeTenant, retryPurgeUsers, triggerInactivityLifecycle } from '@/lib/api/admin'
import type { TenantActivity, TenantStatus, TenantWithDetails } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EntitlementDialog } from '@/components/admin/entitlement-dialog'
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog'
import { GrantBetaDialog } from '@/components/admin/grant-beta-dialog'
import { ReassignAppTargetDialog } from '@/components/admin/reassign-app-target-dialog'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { StatusBadge } from '@/components/status-badge'
import { getSubscriptionPeriodInfo, resolveTenantDisplayStatus } from '@/lib/plan-utils'
import { AlertCircle, Banknote, Check, Clock, Copy, Edit, FlaskConical, Loader2, MoreHorizontal, Play, RefreshCw, Search, Server, ShieldAlert, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const STATUSES: TenantStatus[] = ['trial', 'active', 'free', 'past_due', 'paused', 'suspended', 'cancelled']

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Never'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatExactDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Never'
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithDetails[]>([])
  const [defaultTarget, setDefaultTarget] = useState<{ id: string; label: string; app_base_url: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TenantStatus>('all')
  const [editing, setEditing] = useState<TenantWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reassigning, setReassigning] = useState<TenantWithDetails | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [paymentTenant, setPaymentTenant] = useState<TenantWithDetails | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [betaTenant, setBetaTenant] = useState<TenantWithDetails | null>(null)
  const [betaOpen, setBetaOpen] = useState(false)
  const [failedIdentities, setFailedIdentities] = useState<{ tenantName: string; userIds: string[]; targetId?: string } | null>(null)
  const [retryingPurge, setRetryingPurge] = useState(false)
  const [deleteTargetTenant, setDeleteTargetTenant] = useState<TenantWithDetails | null>(null)

  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCopy(id: string, text: string) {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Email copied to clipboard')
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000)
  }

  const [plansMap, setPlansMap] = useState<Record<string, { id: string; name: string; user_limit: number | null }>>({})
  const [paymentsMap, setPaymentsMap] = useState<
    Record<string, { count: number; hasBeta: boolean; lastPeriodEnd: string | null }>
  >({})

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true)
    }
    const [tenantsResult, defaultTargetResult, activityResult, plansResult, paymentsResult] = await Promise.all([
      supabase
        .from('tenants')
        .select('*, tenant_subscriptions(*), app_target:app_targets(id, label, app_base_url)')
        .order('created_at', { ascending: false }),
      supabase
        .from('app_targets')
        .select('id, label, app_base_url')
        .eq('is_default', true)
        .maybeSingle(),
      fetchTenantsActivity().catch(() => ({ activity: {} })),
      supabase.from('subscription_plans').select('id, name, user_limit'),
      supabase.from('billing_payments').select('id, tenant_id, status, method, period_end, created_at'),
    ])

    if (defaultTargetResult.data) {
      setDefaultTarget(defaultTargetResult.data)
    }

    if (plansResult.data) {
      const map: Record<string, { id: string; name: string; user_limit: number | null }> = {}
      for (const p of plansResult.data) {
        map[p.id] = p
      }
      setPlansMap(map)
    }

    if (paymentsResult?.data) {
      const map: Record<string, { count: number; hasBeta: boolean; lastPeriodEnd: string | null }> = {}
      for (const p of paymentsResult.data) {
        if (p.status === 'captured') {
          if (!map[p.tenant_id]) {
            map[p.tenant_id] = { count: 0, hasBeta: false, lastPeriodEnd: null }
          }
          map[p.tenant_id].count += 1
          if (p.method === 'beta') {
            map[p.tenant_id].hasBeta = true
          }
          if (
            p.period_end &&
            (!map[p.tenant_id].lastPeriodEnd ||
              new Date(p.period_end) > new Date(map[p.tenant_id].lastPeriodEnd!))
          ) {
            map[p.tenant_id].lastPeriodEnd = p.period_end
          }
        }
      }
      setPaymentsMap(map)
    }

    if (tenantsResult.error) {
      toast.error('Could not load tenants', { description: tenantsResult.error.message })
    } else {
      const activityMap: Record<string, TenantActivity> = activityResult.activity ?? {}
      setTenants(
        (tenantsResult.data ?? []).map((row) => ({
          ...row,
          tenant_subscriptions: Array.isArray(row.tenant_subscriptions)
            ? (row.tenant_subscriptions[0] ?? null)
            : row.tenant_subscriptions,
          activity: activityMap[row.id],
        })) as TenantWithDetails[],
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handlePurge(tenant: TenantWithDetails) {
    const toastId = toast.loading(`Deleting ${tenant.business_name} and all data…`)
    const { error, partialFailures } = await purgeTenant(tenant.id)
    if (error) {
      toast.error('Could not delete tenant', { id: toastId, description: error })
      return
    }
    if (partialFailures.length > 0) {
      const userIds = partialFailures.map((f) => f.userId)
      setFailedIdentities({
        tenantName: tenant.business_name,
        userIds,
        targetId: tenant.app_target_id ?? undefined,
      })
      toast.warning(`${tenant.business_name} deleted, but some logins remain`, {
        id: toastId,
        description: `${partialFailures.length} Web App login${partialFailures.length === 1 ? '' : 's'} could not be deleted. Use the Retry action below.`,
        duration: 15000,
      })
    } else {
      setFailedIdentities(null)
      toast.success(`${tenant.business_name} permanently deleted`, {
        id: toastId,
        description: 'Tenant workspace, all database records, and logins were completely removed.',
      })
    }
    void load(true)
  }

  async function handleRetryPurge() {
    if (!failedIdentities || failedIdentities.userIds.length === 0) return
    setRetryingPurge(true)
    const { error, partialFailures } = await retryPurgeUsers(failedIdentities.userIds, failedIdentities.targetId)
    setRetryingPurge(false)

    if (error) {
      toast.error('Retry purge failed', { description: error })
      return
    }

    if (partialFailures.length > 0) {
      setFailedIdentities((prev) =>
        prev ? { ...prev, userIds: partialFailures.map((f) => f.userId) } : null,
      )
      toast.warning(`${partialFailures.length} identities still could not be deleted`, {
        description: partialFailures.map((f) => `${f.userId}: ${f.error}`).join('; '),
      })
    } else {
      setFailedIdentities(null)
      toast.success('All orphaned identities purged successfully')
    }
  }

  const [runningLifecycle, setRunningLifecycle] = useState(false)

  async function handleResume(tenant: TenantWithDetails) {
    const toastId = toast.loading(`Resuming ${tenant.business_name}…`)
    const { status, error } = await resumeTenant(tenant.id)
    if (error) {
      toast.error(`Could not resume ${tenant.business_name}`, { id: toastId, description: error })
      return
    }
    toast.success(`${tenant.business_name} resumed!`, {
      id: toastId,
      description: `Status restored to ${status}. Workspace access is now active.`,
    })
    void load(true)
  }

  async function handleRunLifecycle() {
    setRunningLifecycle(true)
    const toastId = toast.loading('Evaluating inactivity lifecycle (15d pause / 30d suspend / 60d purge)…')
    const result = await triggerInactivityLifecycle()
    setRunningLifecycle(false)
    if (!result.ok || result.error) {
      toast.error('Lifecycle check failed', { id: toastId, description: result.error ?? 'Unknown error' })
      return
    }
    toast.success('Inactivity policy evaluated', {
      id: toastId,
      description: `Checked ${result.totalChecked ?? 0} workspaces: ${result.pausedCount ?? 0} paused, ${result.suspendedCount ?? 0} suspended, ${result.purgedCount ?? 0} purged.`,
    })
    void load(true)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tenants.filter((t) => {
      const email = t.activity?.email || t.web_app_email || ''
      const matchesQuery =
        !q ||
        t.business_name.toLowerCase().includes(q) ||
        t.subdomain_slug.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q)
      const displayStatus = resolveTenantDisplayStatus(t.status, t.tenant_subscriptions)
      const matchesStatus = statusFilter === 'all' || displayStatus === statusFilter || t.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [tenants, query, statusFilter])

  return (
    <div className="space-y-3.5">
      <AdminPageHeader
        title="Tenants"
        description="All business workspaces provisioned across Bill2CRM Control Plane and Web Apps."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunLifecycle}
              disabled={runningLifecycle}
              className="h-8 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 text-xs"
            >
              {runningLifecycle ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="mr-1.5 size-3.5 text-amber-600" />
              )}
              Run Inactivity Lifecycle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="h-8 px-2.5 text-xs"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-1.5 hidden sm:inline">Refresh</span>
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search business, subdomain, email…"
                className="h-8 w-60 pl-8 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize text-xs">
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {failedIdentities && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-semibold">
                Orphaned Web App logins from {failedIdentities.tenantName}
              </p>
              <p className="text-[11px] text-amber-700">
                {failedIdentities.userIds.length} auth user ID(s) failed during initial purge:{' '}
                <span className="font-mono text-[10px]">{failedIdentities.userIds.join(', ')}</span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetryPurge}
            disabled={retryingPurge}
            className="h-7 border-amber-400 bg-white text-xs text-amber-900 hover:bg-amber-100"
          >
            {retryingPurge ? (
              <Loader2 className="mr-1.5 size-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3" />
            )}
            Retry Purge
          </Button>
        </div>
      )}

      {loading && tenants.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent text-xs">
                <TableHead className="py-2 px-2 text-center">Business</TableHead>
                <TableHead className="py-2 px-2 text-center">Owner</TableHead>
                <TableHead className="py-2 px-2 text-center">Status &amp; Plan</TableHead>
                <TableHead className="py-2 px-1.5 text-center" title="Active users / Total user limit">
                  <div>User Count</div>
                  <span className="block text-[9px] font-normal text-muted-foreground">Active/Total</span>
                </TableHead>
                <TableHead className="py-2 px-2 text-center" title="Subscription End / Renewal Date">
                  <div>End Date</div>
                  <span className="block text-[9px] font-normal text-muted-foreground">Expires / Due</span>
                </TableHead>
                <TableHead className="py-2 px-1.5 text-center" title="Subscription Renewed Status">
                  <div>Renewed</div>
                  <span className="block text-[9px] font-normal text-muted-foreground">Yes / No</span>
                </TableHead>
                <TableHead className="py-2 px-2 text-center">Last Active</TableHead>
                <TableHead className="py-2 px-2 text-center">App Target</TableHead>
                <TableHead className="py-2 px-1.5 text-center">Created</TableHead>
                <TableHead className="py-2 px-2 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tenant) => {
                const email = tenant.activity?.email || tenant.web_app_email
                const paymentInfo = paymentsMap[tenant.id]
                const rawSub = tenant.tenant_subscriptions
                // Graceful fallback for missing current_period_end or trial_ends_at
                const subWithFallback = rawSub
                  ? {
                      ...rawSub,
                      trial_ends_at:
                        rawSub.trial_ends_at ||
                        (tenant.status === 'trial' && tenant.created_at
                          ? new Date(new Date(tenant.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
                          : null),
                      current_period_end:
                        rawSub.current_period_end ||
                        paymentInfo?.lastPeriodEnd ||
                        null,
                    }
                  : null

                const displayStatus = resolveTenantDisplayStatus(tenant.status, subWithFallback)
                const periodInfo = getSubscriptionPeriodInfo(subWithFallback)
                const webAppSignIn = tenant.activity?.webAppLastSignInAt
                const cpSignIn = tenant.activity?.controlPlaneLastSignInAt

                const plan = subWithFallback?.plan_id ? plansMap[subWithFallback.plan_id] : null
                const maxUsers = subWithFallback?.user_limit_override ?? plan?.user_limit ?? null
                const activeUsers = tenant.activity?.activeUsers ?? 1
                const totalMembers = tenant.activity?.totalMembers ?? 1
                const totalDisplay = maxUsers !== null ? maxUsers : (totalMembers > 1 ? totalMembers : '∞')

                const isLifetime = Boolean(
                  subWithFallback?.is_lifetime ||
                    subWithFallback?.billing_cycle === 'lifetime' ||
                    subWithFallback?.plan_id?.includes('lifetime'),
                )
                const isTrial = subWithFallback?.status === 'trial' || subWithFallback?.plan_id === 'plan_trial' || tenant.status === 'trial'
                const isFree = subWithFallback?.status === 'free' || subWithFallback?.plan_id === 'plan_free' || tenant.status === 'free'
                const isBeta = Boolean(paymentInfo?.hasBeta || subWithFallback?.plan_id?.includes('beta'))
                const isPastDue = displayStatus === 'past_due' || tenant.status === 'past_due'
                const isExpired = Boolean(periodInfo.isExpired)

                // Renewal calculation
                let isRenewed = false
                let renewalSubtext: string | null = null
                let notRenewedReason: string | null = null

                if (isLifetime) {
                  isRenewed = true
                  renewalSubtext = 'Lifetime'
                } else if (isTrial) {
                  isRenewed = false
                  notRenewedReason = isExpired ? 'Trial Expired' : 'Trial'
                } else if (isFree) {
                  isRenewed = false
                  notRenewedReason = 'Free Tier'
                } else if (isPastDue || isExpired || displayStatus === 'cancelled' || displayStatus === 'suspended') {
                  isRenewed = false
                  notRenewedReason = isPastDue ? 'Past Due' : isExpired ? 'Expired' : 'Suspended'
                } else if (displayStatus === 'active' || tenant.status === 'active') {
                  isRenewed = true
                  if (isBeta) {
                    renewalSubtext = 'Beta (₹0)'
                  } else if ((paymentInfo?.count ?? 0) > 1) {
                    renewalSubtext = `${paymentInfo!.count} Payments`
                  } else {
                    renewalSubtext = 'Active'
                  }
                } else {
                  isRenewed = false
                  notRenewedReason = 'Inactive'
                }

                return (
                  <TableRow key={tenant.id} className="text-xs">
                    <TableCell className="py-1.5 px-2 text-center">
                      <p className="font-medium text-foreground leading-tight">{tenant.business_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{tenant.subdomain_slug}</p>
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-center">
                      {email ? (
                        <div className="inline-flex items-center justify-center gap-1">
                          <span className="font-mono text-xs text-foreground/90 truncate max-w-[130px]" title={email}>
                            {email}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(tenant.id, email)}
                            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0"
                            title="Copy email"
                          >
                            {copiedId === tenant.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-center">
                      <div className="flex flex-col items-center justify-center space-y-0.5 leading-tight">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <StatusBadge status={displayStatus} />
                          {subWithFallback?.billing_cycle && (
                            <span className="rounded bg-muted px-1 py-0.2 text-[9px] font-medium capitalize text-muted-foreground">
                              {subWithFallback.billing_cycle}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[110px]" title={subWithFallback?.plan_id ?? ''}>
                          {subWithFallback?.plan_id ? subWithFallback.plan_id.replace('plan_', '') : '—'}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="py-1.5 px-1.5 text-center">
                      <span
                        className="inline-flex items-center justify-center rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-foreground tracking-tight"
                        title={`${activeUsers} current user${activeUsers === 1 ? '' : 's'} / ${totalDisplay === '∞' ? 'Unlimited' : totalDisplay} total user limit`}
                      >
                        <span className="text-emerald-600 dark:text-emerald-400">{activeUsers}</span>
                        <span className="text-muted-foreground mx-0.5">/</span>
                        <span>{totalDisplay}</span>
                      </span>
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-center whitespace-nowrap">
                      {isLifetime ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.2 text-[11px] font-semibold text-violet-700 dark:text-violet-300 border border-violet-500/30">
                            Lifetime
                          </span>
                          <span className="block text-[9px] text-muted-foreground">No Expiry</span>
                        </div>
                      ) : isFree && !periodInfo.formattedEndDate ? (
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs text-muted-foreground">No Expiry</span>
                          <span className="block text-[9px] text-muted-foreground">Free Tier</span>
                        </div>
                      ) : periodInfo.formattedEndDate ? (
                        <div className="space-y-0.5 leading-tight">
                          <div className="font-mono text-xs font-semibold text-foreground">
                            {periodInfo.formattedEndDate}
                          </div>
                          {isExpired ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive dark:text-red-400">
                              Expired ({Math.abs(periodInfo.diffDays || 0)}d ago)
                            </span>
                          ) : periodInfo.isExpiringSoon ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              {periodInfo.diffDays === 0
                                ? 'Expires today'
                                : periodInfo.diffDays === 1
                                  ? 'Expires tomorrow'
                                  : `${periodInfo.diffDays}d remaining`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              In {periodInfo.diffDays} days
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-1.5 px-1.5 text-center whitespace-nowrap">
                      {isRenewed ? (
                        <div className="flex flex-col items-center justify-center space-y-0.5">
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300 dark:bg-emerald-500/20 border-emerald-500/30 text-[11px] font-semibold px-2 py-0">
                            Yes
                          </Badge>
                          {renewalSubtext && (
                            <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                              {renewalSubtext}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-0.5">
                          <Badge variant="outline" className="text-muted-foreground border-border bg-muted/30 text-[11px] font-medium px-2 py-0">
                            No
                          </Badge>
                          {notRenewedReason && (
                            <span className={`text-[9px] font-medium ${isPastDue || isExpired ? 'text-destructive dark:text-red-400' : 'text-muted-foreground'}`}>
                              {notRenewedReason}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-center">
                      {webAppSignIn ? (
                        <div className="flex items-center justify-center gap-1 font-medium text-foreground leading-tight" title={`CRM Login: ${formatExactDateTime(webAppSignIn)}${cpSignIn ? `\nControl Plane Login: ${formatExactDateTime(cpSignIn)}` : ''}`}>
                          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span>{formatRelativeTime(webAppSignIn)}</span>
                        </div>
                      ) : tenant.activity?.webAppExists ? (
                        <div className="flex justify-center space-y-0.5 leading-tight">
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.2 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="size-2.5" /> Never in CRM
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Pending setup</span>
                      )}
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-center">
                      {tenant.app_target ? (
                        <span className="font-medium text-foreground max-w-[120px] truncate block mx-auto" title={tenant.app_target.label}>
                          {tenant.app_target.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">{defaultTarget?.label ?? 'Default'}</span>
                      )}
                    </TableCell>

                    <TableCell className="py-1.5 px-1.5 text-center font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(tenant.created_at).toLocaleDateString('en-IN')}
                    </TableCell>

                    <TableCell className="py-1.5 px-2 text-center whitespace-nowrap">
                      <div className="flex justify-center items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => {
                            setEditing(tenant)
                            setDialogOpen(true)
                          }}
                          title="Edit plan entitlements and user limits"
                        >
                          <Edit className="mr-1 size-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => {
                            setReassigning(tenant)
                            setReassignOpen(true)
                          }}
                          title="Reassign app target server"
                        >
                          <Server className="mr-1 size-3" />
                          Reassign
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              title="More options"
                            >
                              <MoreHorizontal className="size-3.5" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            {(tenant.status === 'paused' || tenant.status === 'suspended') && (
                              <DropdownMenuItem
                                onClick={() => handleResume(tenant)}
                                className="text-emerald-700 dark:text-emerald-400"
                              >
                                <Play className="mr-2 size-3.5 fill-current" />
                                <span>Resume Workspace</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setPaymentTenant(tenant)
                                setPaymentOpen(true)
                              }}
                            >
                              <Banknote className="mr-2 size-3.5 text-emerald-600" />
                              <span>Offline Payment</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setBetaTenant(tenant)
                                setBetaOpen(true)
                              }}
                            >
                              <FlaskConical className="mr-2 size-3.5 text-violet-600" />
                              <span>Beta Tester Grant (₹0)</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTargetTenant(tenant)}
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              <span>Delete Tenant</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground text-xs">
                    No tenants match the filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Single shared delete confirmation dialog */}
      <AlertDialog open={!!deleteTargetTenant} onOpenChange={(open) => !open && setDeleteTargetTenant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant &quot;{deleteTargetTenant?.business_name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                As a Super Admin, you are directly and permanently deleting this tenant:
              </p>
              <ul className="list-disc pl-5 text-xs space-y-1 text-muted-foreground">
                <li>Control-plane tenant record &amp; subscription</li>
                <li>Web App organization, memberships, and user accounts</li>
                <li>All invoices, appointments, CRM records, and app data</li>
                <li>All uploaded media &amp; storage files</li>
              </ul>
              <p className="text-destructive font-semibold text-xs pt-1">
                This action is immediate and cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 text-xs"
              onClick={() => {
                if (deleteTargetTenant) {
                  void handlePurge(deleteTargetTenant)
                  setDeleteTargetTenant(null)
                }
              }}
            >
              Yes, Delete Tenant Directly
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EntitlementDialog tenant={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
      <RecordPaymentDialog tenant={paymentTenant} open={paymentOpen} onOpenChange={setPaymentOpen} onSaved={load} />
      <GrantBetaDialog tenant={betaTenant} open={betaOpen} onOpenChange={setBetaOpen} onSaved={load} />
      <ReassignAppTargetDialog tenant={reassigning} open={reassignOpen} onOpenChange={setReassignOpen} onSaved={load} />
    </div>
  )
}

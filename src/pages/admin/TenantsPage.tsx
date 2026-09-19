import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchTenantsActivity, purgeTenant, resumeTenant, retryPurgeUsers, triggerInactivityLifecycle } from '@/lib/api/admin'
import type { TenantActivity, TenantStatus, TenantWithDetails } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { EntitlementDialog } from '@/components/admin/entitlement-dialog'
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog'
import { GrantBetaDialog } from '@/components/admin/grant-beta-dialog'
import { ReassignAppTargetDialog } from '@/components/admin/reassign-app-target-dialog'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { StatusBadge } from '@/components/status-badge'
import { resolveTenantDisplayStatus } from '@/lib/plan-utils'
import { AlertCircle, Banknote, Check, Clock, Copy, FlaskConical, Loader2, Play, RefreshCw, Search, ShieldAlert, Trash2 } from 'lucide-react'
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

function formatPeriodEnd(subscription: TenantWithDetails['tenant_subscriptions']): { text: string; alert?: boolean } | null {
  if (!subscription) return null
  if (subscription.is_lifetime || subscription.billing_cycle === 'lifetime') {
    return { text: 'Lifetime access' }
  }
  const dateStr = subscription.status === 'trial' ? subscription.trial_ends_at : subscription.current_period_end
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  const dateFormatted = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  if (diffDays < 0) {
    return { text: `Expired ${Math.abs(diffDays)}d ago (${dateFormatted})`, alert: true }
  }
  if (diffDays === 0) {
    return { text: `Expires today (${dateFormatted})`, alert: true }
  }
  if (diffDays <= 7) {
    return { text: `Expires in ${diffDays}d (${dateFormatted})`, alert: true }
  }
  return { text: `Renews ${dateFormatted}` }
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

  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCopy(id: string, text: string) {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Email copied to clipboard')
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000)
  }

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true)
    }
    const [tenantsResult, defaultTargetResult, activityResult] = await Promise.all([
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
    ])

    if (defaultTargetResult.data) {
      setDefaultTarget(defaultTargetResult.data)
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

  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null)

  async function handlePurge(tenant: TenantWithDetails) {
    setDeletingTenantId(tenant.id)
    const toastId = toast.loading(`Deleting ${tenant.business_name} and all data…`)
    const { error, partialFailures } = await purgeTenant(tenant.id)
    setDeletingTenantId(null)
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Tenants"
        description="All business workspaces provisioned across Bill2CRM Control Plane and Web Apps."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunLifecycle}
              disabled={runningLifecycle}
              title="Evaluate 15-day inactivity pause, 30-day suspension, and 60-day auto-purge policy"
              className="h-8 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
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
              className="h-8 px-2.5 text-[13px]"
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
                className="h-8 w-64 pl-8 text-[13px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-8 w-36 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {failedIdentities && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">
                Orphaned Web App logins from {failedIdentities.tenantName}
              </p>
              <p className="text-xs text-amber-700">
                {failedIdentities.userIds.length} auth user ID(s) failed during initial purge:{' '}
                <span className="font-mono text-[11px]">{failedIdentities.userIds.join(', ')}</span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetryPurge}
            disabled={retryingPurge}
            className="border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
          >
            {retryingPurge ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            Retry Purge for Failed Identities
          </Button>
        </div>
      )}

      {loading && tenants.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-2.5 px-3">Business</TableHead>
                <TableHead className="py-2.5 px-3">Owner</TableHead>
                <TableHead className="py-2.5 px-3">Status & Plan</TableHead>
                <TableHead className="py-2.5 px-3">Last Active</TableHead>
                <TableHead className="py-2.5 px-3">App Target</TableHead>
                <TableHead className="py-2.5 px-3">Created</TableHead>
                <TableHead className="py-2.5 px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tenant) => {
                const email = tenant.activity?.email || tenant.web_app_email
                const periodEnd = formatPeriodEnd(tenant.tenant_subscriptions)
                const webAppSignIn = tenant.activity?.webAppLastSignInAt
                const cpSignIn = tenant.activity?.controlPlaneLastSignInAt

                return (
                  <TableRow key={tenant.id} className="text-xs">
                    <TableCell className="py-2 px-3">
                      <p className="font-medium text-foreground leading-tight">{tenant.business_name}</p>
                    </TableCell>

                    <TableCell className="py-2 px-3">
                      {email ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-foreground/90 truncate max-w-[150px]" title={email}>
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

                    <TableCell className="py-2 px-3">
                      <div className="space-y-0.5 leading-tight">
                        <div className="flex items-center gap-1">
                          <StatusBadge status={resolveTenantDisplayStatus(tenant.status, tenant.tenant_subscriptions)} />
                          {tenant.tenant_subscriptions?.billing_cycle && (
                            <span className="rounded bg-muted px-1 py-0.2 text-[9px] font-medium capitalize text-muted-foreground">
                              {tenant.tenant_subscriptions.billing_cycle}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[130px]" title={tenant.tenant_subscriptions?.plan_id ?? ''}>
                          {tenant.tenant_subscriptions?.plan_id ?? '—'}
                        </p>
                        {periodEnd && (
                          <p
                            className={`text-[10px] ${
                              periodEnd.alert ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                            }`}
                          >
                            {periodEnd.text}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-2 px-3">
                      {webAppSignIn ? (
                        <div className="space-y-0.5 leading-tight" title={`CRM Login: ${formatExactDateTime(webAppSignIn)}${cpSignIn ? `\nControl Plane Login: ${formatExactDateTime(cpSignIn)}` : ''}`}>
                          <div className="flex items-center gap-1 font-medium text-foreground">
                            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                            <span>{formatRelativeTime(webAppSignIn)}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            CRM: {formatExactDateTime(webAppSignIn).split(',')[0]}
                          </p>
                        </div>
                      ) : tenant.activity?.webAppExists ? (
                        <div className="space-y-0.5 leading-tight">
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.2 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="size-2.5" /> Never in CRM
                          </span>
                          {cpSignIn && (
                            <p className="text-[10px] text-muted-foreground">
                              Portal: {formatRelativeTime(cpSignIn)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5 leading-tight">
                          <span className="text-[10px] text-muted-foreground">Pending setup</span>
                          {cpSignIn && (
                            <p className="text-[10px] text-muted-foreground">
                              Portal: {formatRelativeTime(cpSignIn)}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="py-2 px-3">
                      {tenant.app_target ? (
                        <div className="space-y-0.5 leading-tight">
                          <span className="font-medium text-foreground">{tenant.app_target.label}</span>
                        </div>
                      ) : (
                        <div className="space-y-0.5 leading-tight">
                          <span className="text-muted-foreground">{defaultTarget?.label ?? 'Default'}</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="py-2 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(tenant.created_at).toLocaleDateString('en-IN')}
                    </TableCell>

                    <TableCell className="py-2 px-3 text-right">
                      <div className="flex justify-end items-center gap-1">
                        {(tenant.status === 'paused' || tenant.status === 'suspended') && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                            onClick={() => handleResume(tenant)}
                            title="Resume this inactive workspace"
                          >
                            <Play className="mr-1 size-3 fill-current" />
                            Resume
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setReassigning(tenant)
                            setReassignOpen(true)
                          }}
                        >
                          Reassign
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          onClick={() => {
                            setPaymentTenant(tenant)
                            setPaymentOpen(true)
                          }}
                          title="Record offline cash/bank/UPI payment"
                        >
                          <Banknote className="mr-1 size-3" />
                          Offline Pay
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-violet-500/30 text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
                          onClick={() => {
                            setBetaTenant(tenant)
                            setBetaOpen(true)
                          }}
                          title="Grant complimentary beta testing access"
                        >
                          <FlaskConical className="mr-1 size-3" />
                          Beta
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setEditing(tenant)
                            setDialogOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-destructive/30 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={deletingTenantId === tenant.id}
                              title="Directly delete this tenant and all data"
                            >
                              {deletingTenantId === tenant.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="mr-1 size-3" />
                                  <span>Delete</span>
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Tenant "{tenant.business_name}"?</AlertDialogTitle>
                              <AlertDialogDescription className="space-y-2">
                                <p>
                                  As a Super Admin, you are directly and permanently deleting this tenant:
                                </p>
                                <ul className="list-disc pl-5 text-xs space-y-1 text-muted-foreground">
                                  <li>Control-plane tenant record & subscription</li>
                                  <li>Web App organization, memberships, and user accounts</li>
                                  <li>All invoices, appointments, CRM records, and app data</li>
                                  <li>All uploaded media & storage files</li>
                                </ul>
                                <p className="text-destructive font-semibold text-xs pt-1">
                                  This action is immediate and cannot be undone.
                                </p>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-white hover:bg-destructive/90"
                                onClick={() => handlePurge(tenant)}
                              >
                                Yes, Delete Tenant Directly
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No tenants match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <EntitlementDialog tenant={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
      <RecordPaymentDialog tenant={paymentTenant} open={paymentOpen} onOpenChange={setPaymentOpen} onSaved={load} />
      <GrantBetaDialog tenant={betaTenant} open={betaOpen} onOpenChange={setBetaOpen} onSaved={load} />
      <ReassignAppTargetDialog tenant={reassigning} open={reassignOpen} onOpenChange={setReassignOpen} onSaved={load} />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { purgeTenant, retryPurgeUsers } from '@/lib/api/admin'
import type { TenantStatus, TenantWithDetails } from '@/types/database'
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
import { ReassignAppTargetDialog } from '@/components/admin/reassign-app-target-dialog'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { StatusBadge } from '@/components/status-badge'
import { AlertCircle, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const STATUSES: TenantStatus[] = ['trial', 'active', 'free', 'past_due', 'suspended', 'cancelled']

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
  const [failedIdentities, setFailedIdentities] = useState<{ tenantName: string; userIds: string[]; targetId?: string } | null>(null)
  const [retryingPurge, setRetryingPurge] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [tenantsResult, defaultTargetResult] = await Promise.all([
      supabase
        .from('tenants')
        .select('*, tenant_subscriptions(*), app_target:app_targets(id, label, app_base_url)')
        .order('created_at', { ascending: false }),
      supabase
        .from('app_targets')
        .select('id, label, app_base_url')
        .eq('is_default', true)
        .maybeSingle(),
    ])

    if (defaultTargetResult.data) {
      setDefaultTarget(defaultTargetResult.data)
    }

    if (tenantsResult.error) {
      toast.error('Could not load tenants', { description: tenantsResult.error.message })
    } else {
      setTenants(
        (tenantsResult.data ?? []).map((row) => ({
          ...row,
          tenant_subscriptions: Array.isArray(row.tenant_subscriptions)
            ? (row.tenant_subscriptions[0] ?? null)
            : row.tenant_subscriptions,
        })) as TenantWithDetails[],
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', load)
      return () => window.removeEventListener('focus', load)
    }
  }, [load])

  async function handlePurge(tenant: TenantWithDetails) {
    const { error, partialFailures } = await purgeTenant(tenant.id)
    if (error) {
      toast.error('Could not purge tenant', { description: error })
      return
    }
    if (partialFailures.length > 0) {
      const userIds = partialFailures.map((f) => f.userId)
      setFailedIdentities({
        tenantName: tenant.business_name,
        userIds,
        targetId: tenant.app_target_id ?? undefined,
      })
      toast.warning(`${tenant.business_name} purged, but some identities remain`, {
        description: `${partialFailures.length} Web App login${partialFailures.length === 1 ? '' : 's'} could not be deleted. Use the Retry action below.`,
        duration: 15000,
      })
    } else {
      setFailedIdentities(null)
      toast.success(`${tenant.business_name} purged successfully`)
    }
    void load()
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tenants.filter((t) => {
      const matchesQuery = !q || t.business_name.toLowerCase().includes(q) || t.subdomain_slug.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [tenants, query, statusFilter])

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Tenants"
        description={`${tenants.length} workspaces provisioned across all deployments.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search business, subdomain…"
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Business</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>App link</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <p className="font-medium">{tenant.business_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{tenant.subdomain_slug}.bill2crm.in</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tenant.status} />
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {tenant.tenant_subscriptions?.plan_id ?? '—'}
                  </TableCell>
                  <TableCell>
                    {tenant.app_target ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <span>{tenant.app_target.label}</span>
                          <span className="rounded bg-primary/10 px-1 py-0.2 text-[10px] font-semibold text-primary">
                            Assigned
                          </span>
                        </div>
                        {tenant.app_target.app_base_url ? (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {tenant.app_target.app_base_url.replace(/^https?:\/\//, '')}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium">Default</span>
                          {defaultTarget ? (
                            <span className="text-[11px] text-muted-foreground">
                              ({defaultTarget.label})
                            </span>
                          ) : null}
                        </div>
                        {defaultTarget?.app_base_url ? (
                          <p className="font-mono text-[11px] text-muted-foreground/80">
                            {defaultTarget.app_base_url.replace(/^https?:\/\//, '')}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {new Date(tenant.created_at).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
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
                        onClick={() => {
                          setEditing(tenant)
                          setDialogOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Purge {tenant.business_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes their control-panel tenant record and their organization,
                              data, and login in the Web App. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => handlePurge(tenant)}
                            >
                              Purge permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No tenants match.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <EntitlementDialog tenant={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
      <ReassignAppTargetDialog tenant={reassigning} open={reassignOpen} onOpenChange={setReassignOpen} onSaved={load} />
    </div>
  )
}

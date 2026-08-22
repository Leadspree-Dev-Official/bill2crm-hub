import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveUpgradeRequest } from '@/lib/api/admin'
import type { UpgradeRequestWithDetails } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EntitlementDialog } from '@/components/admin/entitlement-dialog'
import { PAYMENT_METHOD_LABEL } from '@/lib/plan-utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function UpgradeRequestsPage() {
  const [requests, setRequests] = useState<UpgradeRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [granting, setGranting] = useState<UpgradeRequestWithDetails | null>(null)
  const [dismissing, setDismissing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('upgrade_requests')
      .select('*, tenant:tenants(*, tenant_subscriptions(*)), requested_plan:subscription_plans(id, name)')
      .in('status', ['pending', 'contacted'])
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('Could not load upgrade requests', { description: error.message })
      setRequests([])
    } else {
      setRequests(
        (data ?? []).map((row) => ({
          ...row,
          tenant: {
            ...row.tenant,
            tenant_subscriptions: Array.isArray(row.tenant?.tenant_subscriptions)
              ? (row.tenant.tenant_subscriptions[0] ?? null)
              : row.tenant?.tenant_subscriptions,
          },
        })) as UpgradeRequestWithDetails[],
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDismiss(request: UpgradeRequestWithDetails) {
    setDismissing(request.id)
    const { error } = await resolveUpgradeRequest(request.id, 'dismissed')
    setDismissing(null)

    if (error) {
      toast.error('Could not dismiss request', { description: error })
      return
    }
    toast.success('Request dismissed')
    void load()
  }

  async function handleGranted() {
    if (!granting) return
    const { error } = await resolveUpgradeRequest(granting.id, 'resolved')
    if (error) {
      toast.error('Entitlement saved, but the request could not be marked resolved', { description: error })
    } else {
      toast.success('Access granted')
    }
    setGranting(null)
    void load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Upgrade requests</h1>
        <p className="text-sm text-muted-foreground">
          Billing isn&apos;t self-serve yet — every request lands here until it&apos;s granted or dismissed.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Requested plan</TableHead>
                <TableHead>Payment method</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.tenant.business_name}
                    <div className="text-xs font-normal text-muted-foreground">
                      {request.tenant.subdomain_slug}.bill2crm.in
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{request.requested_plan?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={request.payment_method === 'whatsapp' ? 'default' : 'outline'}>
                      {PAYMENT_METHOD_LABEL[request.payment_method]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{request.note ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(request.created_at).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={dismissing === request.id}
                      onClick={() => handleDismiss(request)}
                    >
                      {dismissing === request.id ? <Loader2 className="size-4 animate-spin" /> : 'Dismiss'}
                    </Button>
                    <Button size="sm" onClick={() => setGranting(request)}>
                      Grant access
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No open upgrade requests.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <EntitlementDialog
        tenant={granting?.tenant ?? null}
        open={granting !== null}
        onOpenChange={(open) => {
          if (!open) setGranting(null)
        }}
        onSaved={handleGranted}
        defaultPlanId={granting?.requested_plan_id ?? null}
      />
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { purgeTenant } from '@/lib/api/admin'
import type { TenantWithDetails } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { STATUS_BADGE_VARIANT, STATUS_LABEL } from '@/lib/plan-utils'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<TenantWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reassigning, setReassigning] = useState<TenantWithDetails | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tenants')
      .select('*, tenant_subscriptions(*), app_target:app_targets(id, label)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Could not load tenants', { description: error.message })
    } else {
      setTenants(
        (data ?? []).map((row) => ({
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
  }, [load])

  async function handlePurge(tenant: TenantWithDetails) {
    const { error } = await purgeTenant(tenant.id)
    if (error) {
      toast.error('Could not purge tenant', { description: error })
      return
    }
    toast.success(`${tenant.business_name} purged`)
    void load()
  }

  const filtered = tenants.filter((t) => {
    const q = query.toLowerCase()
    return t.business_name.toLowerCase().includes(q) || t.subdomain_slug.toLowerCase().includes(q) || t.status.includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Tenants</h1>
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search business, subdomain, status…"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
                <TableHead>Subdomain</TableHead>
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
                  <TableCell className="font-medium">{tenant.business_name}</TableCell>
                  <TableCell className="text-muted-foreground">{tenant.subdomain_slug}.bill2crm.in</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[tenant.status]}>{STATUS_LABEL[tenant.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tenant.tenant_subscriptions?.plan_id ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{tenant.app_target?.label ?? 'Default'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(tenant.created_at).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2 text-right">
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
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Purge {tenant.business_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes their control-plane tenant record and their organization,
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
                  </TableCell>
                </TableRow>
              ))}
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
      <ReassignAppTargetDialog
        tenant={reassigning}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        onSaved={load}
      />
    </div>
  )
}

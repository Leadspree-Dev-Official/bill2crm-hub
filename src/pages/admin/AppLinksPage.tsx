import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createAppTarget, deleteAppTarget, setDefaultAppTarget, updateAppTarget } from '@/lib/api/admin'
import type { AppTarget } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'

interface AppTargetRow extends AppTarget {
  tenant_count: number
}

const emptyForm = { id: '', label: '', supabaseUrl: '', serviceRoleKey: '', isDefault: false }
type FormState = typeof emptyForm

export default function AppLinksPage() {
  const [targets, setTargets] = useState<AppTargetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('app_targets')
      .select('*, tenants(count)')
      .order('created_at')

    if (error) {
      toast.error('Could not load app links', { description: error.message })
    } else {
      setTargets(
        (data ?? []).map((row) => ({
          ...row,
          tenant_count: Array.isArray(row.tenants) ? (row.tenants[0]?.count ?? 0) : 0,
        })) as AppTargetRow[],
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openForCreate() {
    setForm({ ...emptyForm, isDefault: targets.length === 0 })
    setOpen(true)
  }

  function openForEdit(target: AppTargetRow) {
    setForm({ id: target.id, label: target.label, supabaseUrl: target.supabase_url, serviceRoleKey: '', isDefault: target.is_default })
    setOpen(true)
  }

  async function save() {
    if (!form.label.trim() || !form.supabaseUrl.trim()) {
      toast.error('Label and Supabase URL are required')
      return
    }
    if (!form.id && !form.serviceRoleKey.trim()) {
      toast.error('Service role key is required')
      return
    }

    setSaving(true)
    const { error } = form.id
      ? await updateAppTarget({
          targetId: form.id,
          label: form.label.trim(),
          supabaseUrl: form.supabaseUrl.trim(),
          serviceRoleKey: form.serviceRoleKey.trim(),
        })
      : (
          await createAppTarget({
            label: form.label.trim(),
            supabaseUrl: form.supabaseUrl.trim(),
            serviceRoleKey: form.serviceRoleKey.trim(),
            isDefault: form.isDefault,
          })
        )
    if (form.id && !error && form.isDefault) {
      await setDefaultAppTarget(form.id)
    }
    setSaving(false)

    if (error) {
      toast.error('Could not save app link', { description: error })
      return
    }
    toast.success('App link saved')
    setOpen(false)
    void load()
  }

  async function handleSetDefault(target: AppTargetRow) {
    const { error } = await setDefaultAppTarget(target.id)
    if (error) {
      toast.error('Could not set default', { description: error })
      return
    }
    toast.success(`${target.label} is now the default for new signups`)
    void load()
  }

  async function handleDelete(target: AppTargetRow) {
    const { error } = await deleteAppTarget(target.id)
    if (error) {
      toast.error('Could not delete app link', { description: error })
      return
    }
    toast.success(`${target.label} deleted`)
    void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">App links</h1>
          <p className="text-sm text-muted-foreground">
            Where "Launch my app" and entitlement sync send a tenant. New signups get whichever
            link is default right now; a specific tenant can be pointed at a different one from{' '}
            <span className="font-medium text-foreground">Tenants → Reassign</span> — useful for a
            dedicated, private cloud instance.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openForCreate}>
              <Plus className="size-4" /> Add app link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? 'Edit app link' : 'Add app link'}</DialogTitle>
              <DialogDescription>
                The service role key is encrypted at rest and never shown again after saving —
                {form.id ? ' leave it blank to keep the current one.' : ' from that project\'s Project Settings → API.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  placeholder="Shared cloud"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Supabase URL</Label>
                <Input
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  value={form.supabaseUrl}
                  onChange={(e) => setForm({ ...form, supabaseUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Service role key {form.id && <span className="font-normal text-muted-foreground">(optional — rotates the stored key)</span>}</Label>
                <Input
                  type="password"
                  placeholder={form.id ? 'Leave blank to keep the existing key' : 'eyJhbGciOi... or sb_secret_...'}
                  value={form.serviceRoleKey}
                  onChange={(e) => setForm({ ...form, serviceRoleKey: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="is-default">Default for new signups</Label>
                <Switch
                  id="is-default"
                  checked={form.isDefault}
                  disabled={!form.id && targets.length === 0}
                  onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                />
              </div>
              {!form.id && targets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  This is the first app link, so it becomes the default automatically.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save app link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                <TableHead>Label</TableHead>
                <TableHead>Supabase URL</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell className="font-medium">{target.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{target.supabase_url}</TableCell>
                  <TableCell className="text-muted-foreground">{target.tenant_count}</TableCell>
                  <TableCell>
                    {target.is_default && <Badge>Default</Badge>}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2 text-right">
                    {!target.is_default && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(target)}>
                        Set default
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openForEdit(target)}>
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={target.is_default || target.tenant_count > 0}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {target.label}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the app link and its stored service role key.
                            This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => handleDelete(target)}
                          >
                            Delete permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {targets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No app links yet — add one to enable "Launch my app" for new signups.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

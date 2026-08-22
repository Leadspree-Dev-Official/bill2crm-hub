import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { reassignTenantAppTarget } from '@/lib/api/admin'
import type { AppTarget, TenantWithDetails } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const USE_DEFAULT = '__default__'

export function ReassignAppTargetDialog({
  tenant,
  open,
  onOpenChange,
  onSaved,
}: {
  tenant: TenantWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [targets, setTargets] = useState<AppTarget[]>([])
  const [targetId, setTargetId] = useState<string>(USE_DEFAULT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase
      .from('app_targets')
      .select('*')
      .order('label')
      .then(({ data }) => setTargets((data as AppTarget[]) ?? []))
  }, [open])

  useEffect(() => {
    setTargetId(tenant?.app_target_id ?? USE_DEFAULT)
  }, [tenant])

  async function save() {
    if (!tenant) return
    setSaving(true)
    const { error } = await reassignTenantAppTarget(tenant.id, targetId === USE_DEFAULT ? null : targetId)
    setSaving(false)

    if (error) {
      toast.error('Could not reassign app link', { description: error })
      return
    }
    toast.success('App link updated')
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign {tenant?.business_name}</DialogTitle>
          <DialogDescription>
            Which Web App deployment this tenant's "Launch my app" and entitlement sync point at.
            Use this for a dedicated, private cloud instance — everyone else stays on the default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>App link</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={USE_DEFAULT}>Use whatever is default</SelectItem>
              {targets.map((target) => (
                <SelectItem key={target.id} value={target.id}>
                  {target.label}
                  {target.is_default ? ' (default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

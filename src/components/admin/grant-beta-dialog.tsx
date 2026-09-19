import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { adminGrantBetaAccess } from '@/lib/api/billing'
import { triggerAuthRefresh } from '@/lib/auth-context'
import type { SubscriptionPlan, TenantWithDetails } from '@/types/database'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { FlaskConical, Loader2 } from 'lucide-react'

const PRESET_DAYS = [
  { days: 14, label: '14 Days (2 Weeks)' },
  { days: 30, label: '30 Days (1 Month)' },
  { days: 60, label: '60 Days (2 Months)' },
  { days: 90, label: '90 Days (Quarter)' },
  { days: 180, label: '180 Days (Half Year)' },
  { days: 365, label: '365 Days (1 Year)' },
]

export function GrantBetaDialog({
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
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [days, setDays] = useState(30)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const rows = (data as SubscriptionPlan[]) ?? []
        setPlans(rows)
        if (!planId && rows.length > 0) {
          const defaultPlan = rows.find((p) => p.id === 'plan_pro') || rows[0]
          setPlanId(defaultPlan.id)
        }
      })
  }, [open, planId])

  useEffect(() => {
    if (!tenant) return
    const currentPlanId = tenant.tenant_subscriptions?.plan_id
    if (currentPlanId && currentPlanId !== 'plan_free') {
      setPlanId(currentPlanId)
    }
  }, [tenant])

  const selectedPlan = plans.find((p) => p.id === planId)
  const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant || !planId) return

    setSaving(true)
    const { error } = await adminGrantBetaAccess({
      tenantId: tenant.id,
      planId,
      days,
      note: note.trim() || null,
    })

    setSaving(false)
    if (error) {
      toast.error('Failed to grant beta access', { description: error })
      return
    }

    toast.success('Beta access granted successfully', {
      description: `${tenant.business_name} given ${selectedPlan?.name || planId} access for ${days} days (valid until ${expiryDate.toLocaleDateString('en-IN')}).`,
    })

    triggerAuthRefresh()
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <FlaskConical className="size-4" />
            </div>
            <DialogTitle>Grant Beta / Testing Access</DialogTitle>
          </div>
          <DialogDescription>
            Grant complimentary evaluation access for {tenant?.business_name}. Recorded in the audit ledger as a
            0-rupee beta grant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Entitlement Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={days.toString()} onValueChange={(val) => setDays(parseInt(val, 10))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_DAYS.map((preset) => (
                  <SelectItem key={preset.days} value={preset.days.toString()}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Valid until: <strong>{expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Reason / Testing Purpose (Optional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. VIP client beta testing, pilot trial for Kolkata team"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-violet-600 text-white hover:bg-violet-700">
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FlaskConical className="mr-2 size-4" />}
              Grant Beta Access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { setTenantEntitlement } from '@/lib/api/admin'
import type { SubscriptionPlan, TenantStatus, TenantWithSubscription } from '@/types/database'
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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const STATUSES: TenantStatus[] = ['trial', 'active', 'free', 'past_due', 'suspended', 'cancelled']

export function EntitlementDialog({
  tenant,
  open,
  onOpenChange,
  onSaved,
}: {
  tenant: TenantWithSubscription | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [status, setStatus] = useState<TenantStatus>('trial')
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('')
  const [isLifetime, setIsLifetime] = useState(false)
  const [userLimitOverride, setUserLimitOverride] = useState('')
  const [storageLimitOverride, setStorageLimitOverride] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setPlans((data as SubscriptionPlan[]) ?? []))
  }, [open])

  useEffect(() => {
    if (!tenant) return
    const sub = tenant.tenant_subscriptions
    setPlanId(sub?.plan_id ?? '')
    setStatus(tenant.status)
    setCurrentPeriodEnd(sub?.current_period_end ? sub.current_period_end.slice(0, 10) : '')
    setIsLifetime(sub?.is_lifetime ?? false)
    setUserLimitOverride(sub?.user_limit_override?.toString() ?? '')
    setStorageLimitOverride(sub?.storage_limit_override_mb?.toString() ?? '')
  }, [tenant])

  async function save() {
    if (!tenant) return
    setSaving(true)
    const { error } = await setTenantEntitlement({
      tenantId: tenant.id,
      planId,
      status,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
      isLifetime,
      billingCycle: null,
      userLimitOverride: userLimitOverride ? Number(userLimitOverride) : null,
      storageLimitOverrideMb: storageLimitOverride ? Number(storageLimitOverride) : null,
    })
    setSaving(false)

    if (error) {
      toast.error('Could not update entitlement', { description: error })
      return
    }
    toast.success('Entitlement updated')
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tenant?.business_name}</DialogTitle>
          <DialogDescription>{tenant?.subdomain_slug}.bill2crm.in</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TenantStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Renews / expires on</Label>
            <Input type="date" value={currentPeriodEnd} onChange={(e) => setCurrentPeriodEnd(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="lifetime">Lifetime plan</Label>
            <Switch id="lifetime" checked={isLifetime} onCheckedChange={setIsLifetime} />
          </div>
          <div className="space-y-2">
            <Label>User limit override</Label>
            <Input
              type="number"
              placeholder="Plan default"
              value={userLimitOverride}
              onChange={(e) => setUserLimitOverride(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Storage override (MB)</Label>
            <Input
              type="number"
              placeholder="Plan default"
              value={storageLimitOverride}
              onChange={(e) => setStorageLimitOverride(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !planId}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

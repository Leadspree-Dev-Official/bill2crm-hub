import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { adminRecordManualPayment } from '@/lib/api/billing'
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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Banknote, Loader2 } from 'lucide-react'

type Cycle = 'monthly' | 'yearly' | 'lifetime'
type Method = 'cash' | 'bank_transfer' | 'upi_manual' | 'cheque' | 'comp'

const METHODS: { id: Method; label: string }[] = [
  { id: 'cash', label: 'Cash (Offline)' },
  { id: 'bank_transfer', label: 'Bank Transfer (NEFT / IMPS / RTGS)' },
  { id: 'upi_manual', label: 'UPI Direct (Company VPA)' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'comp', label: 'Complimentary / Comped Access' },
]

export function RecordPaymentDialog({
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
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const [method, setMethod] = useState<Method>('cash')
  const [amountInr, setAmountInr] = useState<string>('')
  const [includeGst, setIncludeGst] = useState(true)
  const [reference, setReference] = useState('')
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

        const sub = tenant?.tenant_subscriptions
        const initialPlanId = sub?.plan_id && sub.plan_id !== 'plan_free' ? sub.plan_id : rows[0]?.id ?? ''
        const initialCycle: Cycle = (sub?.billing_cycle as Cycle) ?? 'monthly'
        const initialMethod: Method = 'cash'

        setPlanId(initialPlanId)
        setCycle(initialCycle)
        setMethod(initialMethod)

        const initialPlan = rows.find((p) => p.id === initialPlanId)
        let price = 0
        if (initialPlan) {
          if (initialCycle === 'monthly') price = initialPlan.price_monthly_inr ?? 0
          else if (initialCycle === 'yearly') price = initialPlan.price_yearly_inr ?? 0
          else if (initialCycle === 'lifetime') price = initialPlan.price_lifetime_inr ?? 0
        }
        setAmountInr(price ? price.toString() : '')
      })
  }, [open, tenant])

  function handleCycleChange(newCycle: Cycle) {
    setCycle(newCycle)
    if (newCycle === 'lifetime') {
      const lifetimePlan = plans.find((p) => p.price_lifetime_inr != null)
      if (lifetimePlan) {
        setPlanId(lifetimePlan.id)
        if (method !== 'comp') {
          setAmountInr(lifetimePlan.price_lifetime_inr ? lifetimePlan.price_lifetime_inr.toString() : '')
        }
        return
      }
    }

    const selectedPlan = plans.find((p) => p.id === planId)
    if (selectedPlan && method !== 'comp') {
      let price = 0
      if (newCycle === 'monthly') price = selectedPlan.price_monthly_inr ?? 0
      else if (newCycle === 'yearly') price = selectedPlan.price_yearly_inr ?? 0
      else if (newCycle === 'lifetime') price = selectedPlan.price_lifetime_inr ?? 0
      setAmountInr(price ? price.toString() : '')
    }
  }

  function handlePlanChange(newPlanId: string) {
    setPlanId(newPlanId)
    const selectedPlan = plans.find((p) => p.id === newPlanId)
    if (!selectedPlan) return

    let nextCycle = cycle
    if (cycle === 'lifetime' && selectedPlan.price_lifetime_inr == null) {
      nextCycle = 'monthly'
      setCycle('monthly')
    }

    if (method === 'comp') {
      setAmountInr('0')
    } else {
      let price = 0
      if (nextCycle === 'monthly') price = selectedPlan.price_monthly_inr ?? 0
      else if (nextCycle === 'yearly') price = selectedPlan.price_yearly_inr ?? 0
      else if (nextCycle === 'lifetime') price = selectedPlan.price_lifetime_inr ?? 0
      setAmountInr(price ? price.toString() : '')
    }
  }

  function handleMethodChange(newMethod: Method) {
    setMethod(newMethod)
    if (newMethod === 'comp') {
      setAmountInr('0')
    } else {
      const selectedPlan = plans.find((p) => p.id === planId)
      if (selectedPlan) {
        let price = 0
        if (cycle === 'monthly') price = selectedPlan.price_monthly_inr ?? 0
        else if (cycle === 'yearly') price = selectedPlan.price_yearly_inr ?? 0
        else if (cycle === 'lifetime') price = selectedPlan.price_lifetime_inr ?? 0
        setAmountInr(price ? price.toString() : '')
      }
    }
  }

  const selectedPlan = plans.find((p) => p.id === planId)
  const baseNum = parseFloat(amountInr) || 0
  const gstNum = includeGst ? Math.round(baseNum * 0.18) : 0
  const totalNum = baseNum + gstNum

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant || !planId) return

    setSaving(true)
    const { error } = await adminRecordManualPayment({
      tenantId: tenant.id,
      planId,
      billingCycle: cycle,
      method,
      amountInr: method === 'comp' ? 0 : baseNum,
      reference: reference.trim() || null,
      note: note.trim() || null,
      includeGst,
    })

    setSaving(false)
    if (error) {
      toast.error('Failed to record payment', { description: error })
      return
    }

    toast.success('Payment recorded & entitlement granted!', {
      description: `Applied ${selectedPlan?.name || planId} (${cycle}) to ${tenant.business_name}. Sequential invoice issued.`,
    })

    triggerAuthRefresh()
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Banknote className="size-4" />
            </div>
            <DialogTitle>Record Offline / Manual Payment</DialogTitle>
          </div>
          <DialogDescription>
            Grant access for {tenant?.business_name} without Razorpay (Cash, direct UPI, or bank transfer). Generates a
            sequential invoice and ledger entry.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={(val) => handleMethodChange(val as Method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Billing Cycle</Label>
              <Select value={cycle} onValueChange={(val) => handleCycleChange(val as Cycle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="lifetime">Lifetime (One-Time - Private Cloud)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Target Plan</Label>
            <Select value={planId} onValueChange={handlePlanChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    disabled={cycle === 'lifetime' && p.price_lifetime_inr == null}
                  >
                    {p.name} {p.price_lifetime_inr != null ? '· Lifetime Eligible' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cycle === 'lifetime' && (
              <p className="text-xs text-muted-foreground">
                Lifetime licenses are exclusively supported on Private Cloud (dedicated database server).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Base Amount (₹ INR)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                disabled={method === 'comp'}
                value={amountInr}
                onChange={(e) => setAmountInr(e.target.value)}
                placeholder="Amount in Rupees"
                required
              />
            </div>

            <div className="flex flex-col justify-end space-y-1.5">
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="text-xs font-medium">Add 18% GST</span>
                <Switch checked={includeGst} onCheckedChange={setIncludeGst} disabled={method === 'comp'} />
              </div>
            </div>
          </div>

          <div className="rounded-md bg-muted/60 p-3 text-xs">
            <div className="flex justify-between py-0.5 text-muted-foreground">
              <span>Base amount:</span>
              <span>₹{baseNum.toLocaleString('en-IN')}</span>
            </div>
            {includeGst && (
              <div className="flex justify-between py-0.5 text-muted-foreground">
                <span>GST (18%):</span>
                <span>₹{gstNum.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t pt-1 font-semibold text-foreground">
              <span>Total recorded:</span>
              <span>₹{totalNum.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Reference / Transaction ID</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UTR 4239847293, Receipt #104, Cheque 89472"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Internal Note (Optional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Handover cash received at Delhi office."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Banknote className="mr-2 size-4" />}
              Record Payment & Grant Access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

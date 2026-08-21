import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { SubscriptionPlan } from '@/types/database'
import { formatInr } from '@/lib/plan-utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function UpgradeRequestDialog({ tenantId }: { tenantId: string }) {
  const { refresh } = useAuth()
  const [open, setOpen] = useState(false)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [planId, setPlanId] = useState<string>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setPlans((data as SubscriptionPlan[]) ?? []))
  }, [open])

  async function submit() {
    if (!planId) {
      toast.error('Choose a plan first')
      return
    }
    setSubmitting(true)
    const { error } = await supabase
      .from('upgrade_requests')
      .insert({ tenant_id: tenantId, requested_plan_id: planId, note: note || null })
    setSubmitting(false)

    if (error) {
      toast.error('Could not submit request', { description: error.message })
      return
    }
    toast.success("Request sent — we'll be in touch shortly.")
    setOpen(false)
    setNote('')
    setPlanId('')
    void refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Request an upgrade</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a plan upgrade</DialogTitle>
          <DialogDescription>
            Billing isn&apos;t self-serve yet — tell us which plan you want and we&apos;ll set it up for you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                    {plan.price_monthly_inr ? ` — ${formatInr(plan.price_monthly_inr)}/mo` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { PaymentMethod, SubscriptionPlan } from '@/types/database'
import { buildWhatsAppOrderLink } from '@/lib/whatsapp'
import { formatInr, PAYMENT_METHOD_LABEL } from '@/lib/plan-utils'
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
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const PAYMENT_METHODS: { value: PaymentMethod; desc: string; comingSoon?: boolean }[] = [
  { value: 'whatsapp', desc: "Message us — we'll confirm and activate your plan by hand." },
  { value: 'razorpay', desc: 'Card, UPI, netbanking — activates automatically.', comingSoon: true },
  { value: 'stripe', desc: 'International cards — activates automatically.', comingSoon: true },
]

export function UpgradeRequestDialog({
  tenantId,
  businessName,
  subdomainSlug,
}: {
  tenantId: string
  businessName: string
  subdomainSlug: string
}) {
  const { refresh } = useAuth()
  const [open, setOpen] = useState(false)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [planId, setPlanId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('whatsapp')
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
      .insert({ tenant_id: tenantId, requested_plan_id: planId, note: note || null, payment_method: paymentMethod })
    setSubmitting(false)

    if (error) {
      toast.error('Could not submit request', { description: error.message })
      return
    }

    if (paymentMethod === 'whatsapp') {
      const plan = plans.find((p) => p.id === planId)
      const link = buildWhatsAppOrderLink({ businessName, subdomainSlug, planName: plan?.name ?? 'requested' })
      if (link) window.open(link, '_blank', 'noopener,noreferrer')
    }

    toast.success("Request sent — we'll be in touch shortly.")
    setOpen(false)
    setNote('')
    setPlanId('')
    setPaymentMethod('whatsapp')
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
            <Label>Payment method</Label>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              {PAYMENT_METHODS.map((method) => (
                <PaymentOption key={method.value} id={method.value} desc={method.desc} comingSoon={method.comingSoon}>
                  {PAYMENT_METHOD_LABEL[method.value]}
                </PaymentOption>
              ))}
            </RadioGroup>
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

function PaymentOption({
  id,
  children,
  desc,
  comingSoon,
}: {
  id: string
  children: ReactNode
  desc: string
  comingSoon?: boolean
}) {
  return (
    <Label
      htmlFor={`payment-${id}`}
      className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${
        comingSoon ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/50'
      }`}
    >
      <RadioGroupItem value={id} id={`payment-${id}`} disabled={comingSoon} className="mt-0.5" />
      <span className="flex-1 space-y-0.5">
        <span className="flex items-center gap-2 text-sm font-medium leading-none">
          {children}
          {comingSoon && (
            <Badge variant="secondary" className="font-normal">
              Coming soon
            </Badge>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </Label>
  )
}

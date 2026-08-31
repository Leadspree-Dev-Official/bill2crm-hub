import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, Lock, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardShell } from '@/components/dashboard-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { buildWhatsAppOrderLink, isWhatsAppConfigured } from '@/lib/whatsapp'
import { formatInr } from '@/lib/plan-utils'
import type { PaymentMethod, SubscriptionPlan } from '@/types/database'
import { cn } from '@/lib/utils'

type Cycle = 'monthly' | 'yearly' | 'lifetime'

const METHODS: { id: PaymentMethod; name: string; detail: string; icon: typeof MessageCircle; live: boolean }[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp & direct transfer',
    detail:
      'Opens a chat with our accounts team with your plan details filled in. Pay by UPI, NEFT or IMPS and we activate your plan against a GST invoice.',
    icon: MessageCircle,
    live: true,
  },
  {
    id: 'razorpay',
    name: 'Razorpay instant checkout',
    detail: 'UPI, cards, netbanking and wallets. Our Razorpay account is being activated — until it is, upgrade over WhatsApp.',
    icon: CreditCard,
    live: false,
  },
  {
    id: 'stripe',
    name: 'Stripe global checkout',
    detail: 'International card payments for export and overseas billing. Not yet available.',
    icon: CreditCard,
    live: false,
  },
]

export default function UpgradePage() {
  const { tenant, refresh } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [method, setMethod] = useState<PaymentMethod>('whatsapp')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const rows = (data as SubscriptionPlan[]) ?? []
        setPlans(rows)
        setPlanId((current) => current || rows[0]?.id || '')
      })
  }, [])

  // The WhatsApp business number isn't configured in every environment. When it isn't,
  // buildWhatsAppOrderLink always returns null and no chat window ever opens — the copy below
  // needs to say so honestly instead of promising a handoff that won't happen.
  const whatsappConfigured = isWhatsAppConfigured()
  const willOpenWhatsApp = method === 'whatsapp' && whatsappConfigured

  const plan = plans.find((p) => p.id === planId)
  const cycles: Cycle[] = plan?.price_lifetime_inr != null ? ['monthly', 'yearly', 'lifetime'] : ['monthly', 'yearly']
  const amount =
    !plan ? null : cycle === 'monthly' ? plan.price_monthly_inr : cycle === 'yearly' ? plan.price_yearly_inr : plan.price_lifetime_inr

  async function submit() {
    if (!tenant || !plan) {
      toast.error('Choose a plan first')
      return
    }
    setSubmitting(true)

    // NOTE — no gateway checkout runs here on purpose.
    //
    // A previous client-side Razorpay block opened checkout in the browser and then wrote
    // `status: 'paid'` straight from the success handler. That was wrong twice over: the
    // browser is not allowed to declare a payment settled (no signature was ever verified
    // server-side), and 'paid' is not even a value the status CHECK constraint accepts, so
    // the insert failed while the UI still announced "Payment verified!" — taking money and
    // recording nothing.
    //
    // Until the Razorpay account is activated, every upgrade is a request that a super admin
    // grants by hand after confirming payment over WhatsApp. When the gateway does land it
    // must settle through a server-side webhook that verifies the Razorpay signature; the
    // browser may only ever open checkout.

    const { error } = await supabase
      .from('upgrade_requests')
      .insert({ tenant_id: tenant.id, requested_plan_id: plan.id, note: note.trim() || null, payment_method: method })
    setSubmitting(false)

    if (error) {
      toast.error('Could not submit request', { description: error.message })
      return
    }

    if (method === 'whatsapp') {
      const link = buildWhatsAppOrderLink({ businessName: tenant.business_name, subdomainSlug: tenant.subdomain_slug, planName: plan.name })
      if (link) window.open(link, '_blank', 'noopener,noreferrer')
    }

    if (method === 'razorpay') {
      toast.success('Razorpay upgrade order created', {
        description: 'An invoice with instant payment link has been queued for your workspace.',
      })
    } else if (method === 'stripe') {
      toast.success('Stripe payment order created', {
        description: 'Our global billing portal will send your international card invoice immediately.',
      })
    } else if (willOpenWhatsApp) {
      toast.success('Upgrade request raised', { description: 'Our team activates your plan once payment is confirmed.' })
    } else {
      toast.success('Upgrade request received', {
        description: 'Our team will reach out to you by email shortly to arrange payment and activate your plan.',
      })
    }
    void refresh()
    navigate('/dashboard')
  }

  return (
    <DashboardShell>
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back to workspace
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Upgrade {tenant?.business_name}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Choose a plan and how you&apos;d like to pay. Nothing is charged automatically — a person on our side
        confirms payment and grants the entitlement on your instance.
      </p>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-surface p-6">
            <p className="eyebrow">1 · Choose a plan</p>
            <div className="mt-4 space-y-2.5">
              {plans.map((p) => {
                const selected = p.id === planId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex w-full items-start gap-4 rounded-md border p-4 text-left transition-colors',
                      selected ? 'border-primary bg-primary-soft/60' : 'border-border hover:border-border-strong',
                    )}
                  >
                    <span className={cn('mt-1 size-3.5 shrink-0 rounded-full border-2', selected ? 'border-primary bg-primary' : 'border-border-strong')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{p.name}</span>
                        <span className="tabular font-mono text-[13px] text-muted-foreground">
                          {formatInr(p.price_monthly_inr) ?? 'Custom'}/mo
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{p.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5">
              <Label className="text-xs text-muted-foreground">Billing cycle</Label>
              <div className="mt-2 inline-flex rounded-md border border-border bg-surface-muted p-0.5">
                {cycles.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCycle(c)}
                    aria-pressed={cycle === c}
                    className={cn(
                      'rounded-[4px] px-3.5 py-1.5 text-sm capitalize transition-colors',
                      cycle === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <p className="eyebrow">2 · Payment method</p>
            <div className="mt-4 space-y-2.5">
              {METHODS.map((m) => {
                const selected = m.id === method && m.live
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!m.live}
                    onClick={() => setMethod(m.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex w-full items-start gap-4 rounded-md border p-4 text-left transition-colors',
                      selected && 'border-accent bg-accent-soft/60',
                      !selected && m.live && 'border-border hover:border-border-strong',
                      !m.live && 'cursor-not-allowed border-dashed border-border opacity-60',
                    )}
                  >
                    <m.icon className={cn('mt-0.5 size-4 shrink-0', m.live ? 'text-accent' : 'text-muted-foreground')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        {m.live ? (
                          <Badge className="bg-accent-soft text-accent hover:bg-accent-soft">Live</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                            <Lock className="size-3" />
                            Coming soon
                          </Badge>
                        )}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{m.detail}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 space-y-2">
              <Label htmlFor="note">Note for the billing team (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Need 6 counters before the festival rush. GSTIN for the invoice: 27AAA…"
              />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-lg border border-border bg-surface p-6">
            <p className="eyebrow">Summary</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Business</dt>
                <dd className="text-right font-medium">{tenant?.business_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Instance</dt>
                <dd className="text-right font-mono text-[12px]">{tenant?.subdomain_slug}.bill2crm.in</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{plan?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cycle</dt>
                <dd className="capitalize">{cycle}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <dt className="font-medium">Amount</dt>
                <dd className="tabular font-display text-xl font-semibold">{formatInr(amount) ?? 'Custom'}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-muted-foreground">Exclusive of 18% GST.</p>

            <Button className="mt-5 w-full" onClick={submit} disabled={!plan || submitting}>
              <MessageCircle className="size-4" />
              {willOpenWhatsApp ? 'Continue on WhatsApp' : 'Send upgrade request'}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {willOpenWhatsApp
                ? 'This files your request and opens WhatsApp with the details filled in. Your plan is activated once we confirm the payment.'
                : 'This files your request. Our team will email you shortly to arrange payment and activate the plan.'}
            </p>
          </section>
        </aside>
      </div>
    </DashboardShell>
  )
}

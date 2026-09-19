import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, Crown, Loader2, Lock, MessageCircle, Server } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { triggerAuthRefresh, triggerUpgradeRequestsChanged, useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { buildWhatsAppOrderLink, isWhatsAppConfigured } from '@/lib/whatsapp'
import { formatInr } from '@/lib/plan-utils'
import { startRazorpayCheckout } from '@/lib/api/billing'
import type { PaymentMethod, SubscriptionPlan } from '@/types/database'
import { cn } from '@/lib/utils'

type Cycle = 'monthly' | 'yearly' | 'lifetime'

const CYCLES: { id: Cycle; label: string; badge?: string; desc: string }[] = [
  { id: 'monthly', label: 'Monthly', desc: 'Billed every month' },
  { id: 'yearly', label: 'Yearly', badge: 'Save ~17%', desc: 'Billed once a year' },
  { id: 'lifetime', label: '1-Time Lifetime', badge: 'Pay Once', desc: 'Lifetime workspace access' },
]

const METHODS: { id: PaymentMethod; name: string; detail: string; icon: typeof MessageCircle; live: boolean }[] = [
  {
    id: 'razorpay',
    name: 'Razorpay Instant Checkout',
    detail: 'UPI Autopay, credit/debit cards, netbanking, and wallets with automated recurring renewal.',
    icon: CreditCard,
    live: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp & direct transfer',
    detail:
      'Opens a chat with our accounts team with your plan details filled in. Pay by UPI, NEFT or IMPS and we activate your plan against a GST invoice.',
    icon: MessageCircle,
    live: true,
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
  const { tenant, subscription, refresh } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [cycle, setCycle] = useState<Cycle>('yearly')
  const [method, setMethod] = useState<PaymentMethod>('razorpay')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Lifetime license is ONLY available to Trial or Free workspaces migrating to dedicated Private Cloud.
  // Active subscribers on shared servers cannot switch directly because Private Cloud runs on a separate server.
  const isTrialOrFree =
    tenant?.status === 'trial' ||
    tenant?.status === 'free' ||
    subscription?.status === 'trial' ||
    subscription?.status === 'free'

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const rows = ((data as SubscriptionPlan[]) ?? []).filter(
          (p) => p.id !== 'plan_free' && p.id !== 'plan_trial' && p.id !== 'plan_custom' && p.id !== 'plan_private_cloud_lifetime',
        )
        setPlans(rows)
        const defaultPlan = rows.find((r) => r.id === 'plan_cloud_saas') || rows[0]
        setPlanId((current) => current || defaultPlan?.id || '')
      })
  }, [])

  const handleCycleChange = (newCycle: Cycle) => {
    if (newCycle === 'lifetime' && !isTrialOrFree) {
      toast.error('Lifetime license unavailable for active subscribers', {
        description:
          'Private Cloud runs on an isolated dedicated server. Active subscribers on shared servers cannot switch directly because the server will be different. Please contact support for server migration.',
      })
      return
    }
    setCycle(newCycle)
    if (newCycle === 'lifetime') {
      const lifetimePlan = plans.find((p) => p.price_lifetime_inr != null)
      if (lifetimePlan) {
        setPlanId(lifetimePlan.id)
      }
    }
  }

  // The WhatsApp business number isn't configured in every environment. When it isn't,
  // buildWhatsAppOrderLink always returns null and no chat window ever opens — the copy below
  // needs to say so honestly instead of promising a handoff that won't happen.
  const whatsappConfigured = isWhatsAppConfigured()
  const willOpenWhatsApp = method === 'whatsapp' && whatsappConfigured

  const plan = plans.find((p) => p.id === planId)
  const amount =
    !plan
      ? null
      : cycle === 'monthly'
        ? plan.price_monthly_inr
        : cycle === 'yearly'
          ? plan.price_yearly_inr
          : plan.price_lifetime_inr
  const gstAmount = amount ? Math.round(amount * 0.18) : 0
  const totalAmount = (amount ?? 0) + gstAmount

  async function submit() {
    if (!tenant || !plan) {
      toast.error('Choose a plan first')
      return
    }

    // Client-side lifetime eligibility enforcement
    if (cycle === 'lifetime') {
      if (plan.id !== 'plan_private_cloud') {
        toast.error('Lifetime license is only available for Private Cloud')
        return
      }
      if (!isTrialOrFree) {
        toast.error('Lifetime license unavailable', {
          description:
            'Only Trial or Free workspaces can migrate to dedicated Private Cloud. Active subscribers on shared servers cannot switch directly because the server will be different.',
        })
        return
      }
    }

    setSubmitting(true)

    // Razorpay instant checkout flow
    if (method === 'razorpay') {
      await startRazorpayCheckout({
        planId: plan.id,
        billingCycle: cycle,
        onSuccess: () => {
          setSubmitting(false)
          toast.success('Payment verified & plan activated!', {
            description: `Your workspace has been upgraded to ${plan.name} (${cycle}).`,
          })
          triggerAuthRefresh()
          void refresh()
          navigate('/dashboard')
        },
        onError: (err) => {
          setSubmitting(false)
          toast.error('Payment failed', { description: err })
        },
        onCancel: () => {
          setSubmitting(false)
        },
      })
      return
    }

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

    if (method === 'stripe') {
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
    triggerUpgradeRequestsChanged()
    triggerAuthRefresh()
    void refresh()
    navigate('/dashboard')
  }

  return (
    <AppShell>
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back to workspace
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Upgrade {tenant?.business_name}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Choose your plan and billing frequency. Pay securely via Razorpay for instant automated activation, or
        request an offline invoice.
      </p>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <p className="eyebrow mb-0">1 · Choose a plan & billing cycle</p>
              <div className="inline-flex rounded-lg border border-border bg-surface-muted p-1">
                {CYCLES.map((c) => {
                  const isLifetimeDisabled = c.id === 'lifetime' && !isTrialOrFree
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCycleChange(c.id)}
                      title={isLifetimeDisabled ? 'Only available for Trial/Free workspaces migrating to dedicated Private Cloud' : undefined}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                        cycle === c.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : isLifetimeDisabled
                            ? 'cursor-not-allowed text-muted-foreground/50'
                            : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span>{c.label}</span>
                      {c.badge && (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold',
                            cycle === c.id
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-accent-soft text-accent',
                          )}
                        >
                          {c.badge}
                        </span>
                      )}
                      {isLifetimeDisabled && <Lock className="size-3 text-muted-foreground/50" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Lifetime-only info banner */}
            {cycle === 'lifetime' && (
              <div className="mb-3 flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                <Server className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">Lifetime License · Private Cloud Only</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">
                    The 1-Time Lifetime license is exclusively for Private Cloud, which deploys on an isolated dedicated database server instance. Starter and Cloud SaaS run on shared multi-tenant infrastructure.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2.5">
              {plans.map((p) => {
                const selected = p.id === planId
                const hasLifetime = p.price_lifetime_inr != null
                const isDisabledByLifetime = cycle === 'lifetime' && !hasLifetime
                const currentPrice =
                  cycle === 'monthly'
                    ? p.price_monthly_inr
                    : cycle === 'yearly'
                      ? p.price_yearly_inr
                      : p.price_lifetime_inr
                const suffix =
                  cycle === 'monthly'
                    ? '/mo'
                    : cycle === 'yearly'
                      ? '/yr'
                      : ' one-time'

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !isDisabledByLifetime && setPlanId(p.id)}
                    aria-pressed={selected}
                    disabled={isDisabledByLifetime}
                    className={cn(
                      'flex w-full items-start gap-4 rounded-md border p-4 text-left transition-colors',
                      isDisabledByLifetime
                        ? 'cursor-not-allowed border-dashed border-border opacity-50'
                        : selected
                          ? 'border-primary bg-primary-soft/60'
                          : 'border-border hover:border-border-strong',
                    )}
                  >
                    <span className={cn('mt-1 size-3.5 shrink-0 rounded-full border-2', isDisabledByLifetime ? 'border-border' : selected ? 'border-primary bg-primary' : 'border-border-strong')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{p.name}</span>
                          {isDisabledByLifetime && (
                            <Badge variant="outline" className="text-[10px] font-normal">Monthly & Annual only</Badge>
                          )}
                          {cycle === 'lifetime' && hasLifetime && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 text-[10px] font-semibold gap-1">
                              <Crown className="size-3" /> Dedicated Server
                            </Badge>
                          )}
                        </span>
                        <span className="tabular font-mono text-[13px] font-semibold text-foreground">
                          {isDisabledByLifetime ? '—' : currentPrice != null ? `${formatInr(currentPrice)}${suffix}` : 'Custom'}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{p.description}</span>
                    </span>
                  </button>
                )
              })}
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
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{plan?.name ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Cycle</dt>
                <dd>
                  <div className="inline-flex rounded-md border border-border bg-surface-muted p-0.5">
                    {CYCLES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCycleChange(c.id)}
                        className={cn(
                          'rounded-[3px] px-2 py-0.5 text-[11px] font-medium transition-colors',
                          cycle === c.id
                            ? 'bg-primary text-primary-foreground'
                            : c.id === 'lifetime' && !isTrialOrFree
                              ? 'cursor-not-allowed text-muted-foreground/50'
                              : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {c.id === 'lifetime' ? '1-Time' : c.label}
                      </button>
                    ))}
                  </div>
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">Base amount</dt>
                <dd className="tabular font-medium">{formatInr(amount) ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">GST (18%)</dt>
                <dd className="tabular font-medium">{amount ? `₹${gstAmount.toLocaleString('en-IN')}` : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-semibold text-foreground">Total payable</dt>
                <dd className="tabular font-display text-xl font-bold text-foreground">
                  {amount ? `₹${totalAmount.toLocaleString('en-IN')}` : '—'}
                </dd>
              </div>
            </dl>

            <Button className="mt-5 w-full gap-2" onClick={submit} disabled={!plan || submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : method === 'razorpay' ? (
                <CreditCard className="size-4" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              {method === 'razorpay'
                ? `Pay ₹${totalAmount.toLocaleString('en-IN')} via Razorpay`
                : willOpenWhatsApp
                  ? 'Continue on WhatsApp'
                  : 'Send upgrade request'}
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {method === 'razorpay'
                ? cycle === 'lifetime'
                  ? 'Instant activation via Razorpay gateway. One-time payment for lifetime access.'
                  : `Instant activation via Razorpay gateway. Automatic recurring renewal for ${cycle} billing.`
                : willOpenWhatsApp
                  ? 'This files your request and opens WhatsApp with the details filled in. Your plan is activated once we confirm the payment.'
                  : 'This files your request. Our team will email you shortly to arrange payment and activate the plan.'}
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}

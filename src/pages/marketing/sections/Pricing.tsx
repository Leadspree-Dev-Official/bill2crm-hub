import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { SubscriptionPlan } from '@/types/database'
import { formatInr, formatLimit } from '@/lib/plan-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHead } from './SectionHead'

type BillingToggle = 'monthly' | 'yearly'

export function Pricing() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [billing, setBilling] = useState<BillingToggle>('yearly')

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setPlans((data as SubscriptionPlan[]) ?? []))
  }, [])

  return (
    <section id="pricing" className="relative border-b border-border bg-surface-muted px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Pricing"
          title="Simple pricing that pays for itself"
          desc="Start free. Upgrade only when you need more. No hidden fees, cancel anytime."
        />

        <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
          <div
            role="group"
            aria-label="Billing cycle"
            className="inline-flex rounded-md border border-border bg-surface p-0.5"
          >
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setBilling(c)}
                aria-pressed={billing === c}
                className={cn(
                  'rounded-[4px] px-4 py-1.5 text-sm font-medium capitalize transition-colors',
                  billing === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Badge variant="outline" className="border-accent/40 bg-accent-soft font-mono text-[11px] text-accent">
            Save up to 20% yearly
          </Badge>
        </div>

        {plans.length === 0 ? (
          <p className="text-center text-muted-foreground">Plans will appear here once the control-plane project is connected.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} billing={billing} />
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              7-day free trial · No credit card required · Cancel anytime
            </p>
            <ComparisonTable plans={plans} />
          </>
        )}
      </div>
    </section>
  )
}

function PlanCard({ plan, billing }: { plan: SubscriptionPlan; billing: BillingToggle }) {
  const highlighted = plan.id === 'plan_private_cloud'
  const isLifetimeOnly = plan.price_lifetime_inr != null && plan.price_monthly_inr == null
  const isCustom = plan.price_monthly_inr == null && plan.price_yearly_inr == null && plan.price_lifetime_inr == null

  let priceLabel = 'Custom'
  let priceSuffix = ''
  if (isLifetimeOnly) {
    priceLabel = formatInr(plan.price_lifetime_inr) ?? 'Custom'
    priceSuffix = 'one-time'
  } else if (billing === 'monthly' && plan.price_monthly_inr != null) {
    priceLabel = formatInr(plan.price_monthly_inr) ?? 'Custom'
    priceSuffix = '/month'
  } else if (billing === 'yearly' && plan.price_yearly_inr != null) {
    priceLabel = formatInr(Math.round(plan.price_yearly_inr / 12)) ?? 'Custom'
    priceSuffix = '/month, billed yearly'
  } else if (plan.price_monthly_inr != null) {
    priceLabel = formatInr(plan.price_monthly_inr) ?? 'Custom'
    priceSuffix = '/month'
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-surface p-6',
        highlighted ? 'border-primary/60 shadow-raise ring-1 ring-primary/15' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {highlighted ? (
          <Badge className="shrink-0 bg-primary-soft text-primary hover:bg-primary-soft">Most popular</Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="tabular font-display text-3xl font-semibold">{isCustom ? 'Custom' : priceLabel}</span>
        {!isCustom && <span className="text-xs text-muted-foreground">{priceSuffix}</span>}
      </div>
      <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="size-4 shrink-0 text-accent" />
          {formatLimit(plan.user_limit)} user{plan.user_limit === 1 ? '' : 's'}
        </li>
        {Boolean(plan.feature_flags?.automated_reminders) && (
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-accent" /> Automated reminders
          </li>
        )}
        {Boolean(plan.feature_flags?.priority_support) && (
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-accent" /> Priority support
          </li>
        )}
      </ul>
      <Button asChild variant={highlighted ? 'default' : 'outline'} className="mt-6 w-full">
        <Link to="/signup">{isCustom ? 'Get a quote' : 'Start free trial'}</Link>
      </Button>
    </div>
  )
}

const FEATURE_ROWS: { key: string; label: string; render: (plan: SubscriptionPlan) => ReactNode }[] = [
  { key: 'users', label: 'Users', render: (p) => formatLimit(p.user_limit) },
  { key: 'crm', label: 'Built-in mini CRM', render: (p) => <FlagCell value={p.feature_flags?.crm} /> },
  {
    key: 'automated_reminders',
    label: 'Automated reminders',
    render: (p) => <FlagCell value={p.feature_flags?.automated_reminders} />,
  },
  {
    key: 'doc_vault_limit',
    label: 'Secured Doc Vault',
    render: (p) => {
      const v = p.feature_flags?.doc_vault_limit
      if (v === null || v === undefined) return <Minus className="mx-auto size-4 text-muted-foreground/50" />
      if (typeof v === 'number' && v === 0) return <Minus className="mx-auto size-4 text-muted-foreground/50" />
      return typeof v === 'number' ? `Up to ${v}` : 'Unlimited'
    },
  },
  {
    key: 'priority_support',
    label: 'Priority support',
    render: (p) => <FlagCell value={p.feature_flags?.priority_support} />,
  },
  {
    key: 'custom_website',
    label: 'Custom website',
    render: (p) => <FlagCell value={p.feature_flags?.custom_website} />,
  },
]

function FlagCell({ value }: { value: unknown }) {
  return value ? (
    <Check className="mx-auto size-4 text-accent" />
  ) : (
    <Minus className="mx-auto size-4 text-muted-foreground/50" />
  )
}

function ComparisonTable({ plans }: { plans: SubscriptionPlan[] }) {
  return (
    <div className="mt-14">
      <h3 className="mb-5 text-center text-lg font-semibold">Compare all plans side by side</h3>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3.5 text-left font-medium text-muted-foreground">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="p-3.5 text-center font-semibold">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="p-3.5 text-muted-foreground">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="tabular p-3.5 text-center">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

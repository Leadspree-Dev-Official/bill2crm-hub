import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { SubscriptionPlan } from '@/types/database'
import { formatInr, formatLimit } from '@/lib/plan-utils'
import { Check, Minus } from 'lucide-react'
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
    <section id="pricing" className="relative px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Pricing"
          title="Simple pricing that pays for itself"
          desc="Start free. Upgrade only when you need more. No hidden fees, cancel anytime."
        />

        <div className="mb-10 flex items-center justify-center gap-3 text-sm text-slate-500">
          <span className={billing === 'monthly' ? 'font-semibold text-slate-900' : undefined}>Monthly</span>
          <button
            role="switch"
            aria-checked={billing === 'yearly'}
            onClick={() => setBilling((b) => (b === 'monthly' ? 'yearly' : 'monthly'))}
            className="relative h-7 w-13 rounded-full border border-slate-200 bg-slate-100 transition-colors"
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-slate-900 transition-transform ${
                billing === 'yearly' ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className={billing === 'yearly' ? 'font-semibold text-slate-900' : undefined}>Yearly</span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">-20%</span>
        </div>

        {plans.length === 0 ? (
          <p className="text-center text-slate-400">Plans will appear here once the control-plane project is connected.</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} billing={billing} />
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-slate-400">
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
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlighted ? 'border-slate-900 bg-white shadow-xl' : 'border-slate-200 bg-white shadow-sm'
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-6 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold text-slate-900">{isCustom ? 'Custom' : priceLabel}</span>
        {!isCustom && <span className="text-xs text-slate-400">{priceSuffix}</span>}
      </div>
      <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
        <li className="flex items-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-500" />
          {formatLimit(plan.user_limit)} user{plan.user_limit === 1 ? '' : 's'}
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 shrink-0 text-emerald-500" />
          {formatLimit(plan.storage_limit_mb, ' MB')} storage
        </li>
        {Boolean(plan.feature_flags?.automated_reminders) && (
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-emerald-500" /> Automated reminders
          </li>
        )}
        {Boolean(plan.feature_flags?.priority_support) && (
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-emerald-500" /> Priority support
          </li>
        )}
      </ul>
      <Link
        to="/signup"
        className={`mt-6 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
          highlighted ? 'bg-slate-900 text-white shadow-md' : 'border border-slate-200 text-slate-900 hover:bg-slate-50'
        }`}
      >
        {isCustom ? 'Get a quote' : 'Start free trial'}
      </Link>
    </div>
  )
}

const FEATURE_ROWS: { key: string; label: string; render: (plan: SubscriptionPlan) => ReactNode }[] = [
  { key: 'users', label: 'Users', render: (p) => formatLimit(p.user_limit) },
  { key: 'storage', label: 'Storage', render: (p) => formatLimit(p.storage_limit_mb, ' MB') },
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
      if (v === null || v === undefined) return <Minus className="mx-auto size-4 text-slate-300" />
      if (typeof v === 'number' && v === 0) return <Minus className="mx-auto size-4 text-slate-300" />
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
    <Check className="mx-auto size-4 text-emerald-500" />
  ) : (
    <Minus className="mx-auto size-4 text-slate-300" />
  )
}

function ComparisonTable({ plans }: { plans: SubscriptionPlan[] }) {
  return (
    <div className="mt-14">
      <h3 className="mb-5 text-center text-xl font-bold text-slate-900">Compare all plans side by side</h3>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-3.5 text-left font-medium text-slate-500">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="p-3.5 text-center font-semibold text-slate-900">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0">
                <td className="p-3.5 text-slate-500">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="p-3.5 text-center text-slate-700">
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

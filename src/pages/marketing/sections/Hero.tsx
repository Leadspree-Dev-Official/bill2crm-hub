import { Link } from 'react-router-dom'
import { ArrowRight, Bell, IndianRupee, Receipt, Search, TrendingUp, Users } from 'lucide-react'
import { GridBackground } from '../GridBackground'

const TRUST = ['🇮🇳 Made in India', '✅ GST compliant', '🔒 100% data privacy', '⚡ 7-day free trial']

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-5 pb-0 pt-16 sm:pt-20">
      <GridBackground />
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          🇮🇳 GST Invoicing · POS · Mini CRM · HRMS · Accounting
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Stop juggling 6 apps.
          <br />
          <span className="text-indigo-600">Run your whole business from one dashboard.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
          Bill2CRM replaces separate invoicing software, POS, CRM, inventory spreadsheets, HR tools and manual
          bookkeeping — synced in real time, in one private workspace built for Indian businesses.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 py-3 pl-6 pr-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-transform hover:-translate-y-0.5"
          >
            Start Free Trial — No Card Required
            <span className="grid size-7 place-items-center rounded-full bg-white/20">
              <ArrowRight className="size-4" />
            </span>
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900"
          >
            See pricing <ArrowRight className="size-4" />
          </a>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-slate-500">
          {TRUST.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl px-2">
        <div className="absolute inset-x-10 -bottom-10 top-10 -z-10 rounded-[40px] bg-gradient-to-b from-indigo-200/50 to-transparent blur-2xl" />
        <DashboardMockup />
      </div>
    </section>
  )
}

function DashboardMockup() {
  return (
    <div className="animate-[float-y_7s_ease-in-out_infinite] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <span className="grid size-6 place-items-center rounded-md bg-slate-900 text-xs text-white">🧾</span>
          Bill2CRM
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-400 sm:flex">
          <Search className="size-3.5" /> Search…
        </div>
        <div className="flex items-center gap-3">
          <Bell className="size-4 text-slate-400" />
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              RS
            </span>
            <span className="hidden text-xs font-medium text-slate-600 sm:inline">Rahul Sharma</span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-1 text-lg font-bold text-slate-900">Dashboard</div>
        <p className="mb-5 text-xs text-slate-400">Welcome back! Here's what's happening with your business.</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={IndianRupee} label="Revenue today" value="₹42,180" change="+18.4%" tone="indigo" />
          <StatCard icon={Receipt} label="Invoices sent" value="18" change="+11.8%" tone="emerald" />
          <StatCard icon={Users} label="New leads" value="6" change="+22.0%" tone="amber" />
          <StatCard icon={TrendingUp} label="Repeat customers" value="64%" change="+4.2%" tone="cyan" />
        </div>

        <div className="mt-5 rounded-xl border border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Revenue overview</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
              This month
            </span>
          </div>
          <RevenueChart />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  tone,
}: {
  icon: typeof IndianRupee
  label: string
  value: string
  change: string
  tone: 'indigo' | 'emerald' | 'amber' | 'cyan'
}) {
  const toneClasses = {
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    cyan: 'text-cyan-600 bg-cyan-50',
  }[tone]

  return (
    <div className="rounded-xl border border-slate-100 p-3.5">
      <div className={`mb-2 inline-flex size-7 items-center justify-center rounded-lg ${toneClasses}`}>
        <Icon className="size-3.5" />
      </div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <span>{label}</span>
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-emerald-600">{change} vs last month</div>
    </div>
  )
}

function RevenueChart() {
  const points = [20, 35, 28, 45, 38, 55, 48, 62, 58, 72, 68, 84]
  const max = Math.max(...points)
  const w = 300
  const h = 80
  const step = w / (points.length - 1)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p / max) * h}`).join(' ')
  const area = `${path} L ${w} ${h} L 0 ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#revenueFill)" />
      <path d={path} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

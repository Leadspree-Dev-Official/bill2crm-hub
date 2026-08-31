import { Link } from 'react-router-dom'
import { ArrowRight, Bell, IndianRupee, Receipt, Search, TrendingUp, Users } from 'lucide-react'
import { GridBackground } from '../GridBackground'
import { Button } from '@/components/ui/button'

const TRUST = ['Made in India', 'GST compliant', '100% data privacy', '7-day free trial']

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border px-5 pb-0 pt-16 sm:pt-20">
      <GridBackground />
      <div className="mx-auto max-w-3xl text-center">
        <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 normal-case tracking-normal">
          GST Invoicing · POS · Mini CRM · HRMS · Accounting
        </span>
        <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
          <span className="block" style={{ color: '#FF9933' }}>
            6 apps. 6 headaches.
          </span>
          <span className="block text-foreground">You deserve one.</span>
          <span className="block" style={{ color: '#138808' }}>
            Meet Bill2CRM.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
          Bill2CRM replaces separate invoicing software, POS, CRM, inventory spreadsheets, HR tools and manual
          bookkeeping — synced in real time, in one private workspace built for Indian businesses.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/signup">
              Start free trial — no card required
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {TRUST.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl px-2">
        <div className="absolute inset-x-10 -bottom-10 top-10 -z-10 rounded-[40px] bg-primary/10 blur-2xl" />
        <DashboardMockup />
      </div>
    </section>
  )
}

function DashboardMockup() {
  return (
    <div className="animate-[float-y_7s_ease-in-out_infinite] overflow-hidden rounded-lg border border-border bg-surface shadow-raise">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 font-display font-semibold">
          <span className="grid size-6 place-items-center rounded-sm bg-primary text-xs text-primary-foreground">
            B2
          </span>
          Bill2CRM
        </div>
        <div className="hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground sm:flex">
          <Search className="size-3.5" /> Search…
        </div>
        <div className="flex items-center gap-3">
          <Bell className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              RS
            </span>
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Rahul Sharma</span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">Dashboard</span>
          {/* These figures are illustrative, not a live or averaged customer
              account. Label it so the preview can't be read as a real claim. */}
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Sample data
          </span>
        </div>
        <p className="mb-5 text-xs text-muted-foreground">Welcome back! Here's what's happening with your business.</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={IndianRupee} label="Revenue today" value="₹42,180" change="+18.4%" tone="primary" />
          <StatCard icon={Receipt} label="Invoices sent" value="18" change="+11.8%" tone="accent" />
          <StatCard icon={Users} label="New leads" value="6" change="+22.0%" tone="warning" />
          <StatCard icon={TrendingUp} label="Repeat customers" value="64%" change="+4.2%" tone="info" />
        </div>

        <div className="mt-5 rounded-md border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Revenue overview</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
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
  tone: 'primary' | 'accent' | 'warning' | 'info'
}) {
  const toneClasses = {
    primary: 'text-primary bg-primary-soft',
    accent: 'text-accent bg-accent-soft',
    warning: 'text-warning bg-warning/10',
    info: 'text-info bg-info/10',
  }[tone]

  return (
    <div className="rounded-md border border-border p-3.5">
      <div className={`mb-2 inline-flex size-7 items-center justify-center rounded-md ${toneClasses}`}>
        <Icon className="size-3.5" />
      </div>
      <div className="tabular font-display text-lg font-semibold">{value}</div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>{label}</span>
      </div>
      <div className="mt-0.5 text-[11px] font-medium text-accent">{change} vs last month</div>
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
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#revenueFill)" />
      <path
        d={path}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

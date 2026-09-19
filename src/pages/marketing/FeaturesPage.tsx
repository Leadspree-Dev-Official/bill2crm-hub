import { Link } from 'react-router-dom'
import {
  FileText,
  ScanLine,
  Users,
  Boxes,
  Clock,
  LineChart,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingNav } from './sections/MarketingNav'
import { MarketingFooter } from './sections/MarketingFooter'

const PILLARS = [
  {
    id: 'invoicing',
    title: 'GST Invoicing & Tax Compliance',
    badge: '100% Tax Compliant',
    tagline: 'Zero-error GST billing with automated E-Way bills and GSTR reports',
    icon: FileText,
    accentColor: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    description:
      'Designed specifically for Indian tax laws. Create compliant tax invoices, bills of supply, debit/credit notes, and delivery challans in seconds with automatic HSN/SAC code suggestions.',
    highlights: [
      'Automated B2B & B2C GST billing with CGST, SGST & IGST split calculation',
      'One-click E-Way Bill payload generation for inter-state dispatches over ₹50,000',
      'Instant export of GSTR-1, GSTR-3B and GSTR-9 ready JSON / Excel workbooks',
      'Dynamic UPI QR code printed directly on thermal bills for instant 3-second counter payments',
      'Multi-currency support for export businesses and SEZ transactions',
      'Automated recurring billing and subscription invoicing for service businesses',
    ],
    metric: {
      value: '99.8%',
      label: 'Reduction in tax reconciliation errors',
    },
  },
  {
    id: 'pos',
    title: 'High-Speed Touchscreen POS',
    badge: 'Blazing Fast Checkout',
    tagline: 'Built for busy counters, restaurants, and retail stores with offline resilience',
    icon: ScanLine,
    accentColor: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    description:
      'Keep your billing counters moving at lightning speed even when internet fails. Fast barcode lookup, thermal printer support, and seamless payment collection.',
    highlights: [
      'Sub-second 0.5s barcode scanning with support for wireless & USB handheld scanners',
      'Offline-first architecture: keep billing during WiFi outages, auto-syncs when online',
      'Universal ESC/POS thermal printing support (2-inch & 3-inch, Bluetooth, USB & LAN)',
      'Split payments (Cash + UPI + Card + Udhar credit) on a single bill',
      'Multi-counter and multi-cashier drawer reconciliation with shift opening/closing cash audits',
      'KOT (Kitchen Order Ticket) and table management for cafes and food outlets',
    ],
    metric: {
      value: '< 15s',
      label: 'Average customer checkout turnaround',
    },
  },
  {
    id: 'crm',
    title: 'Customer CRM & WhatsApp Automation',
    badge: 'Direct Customer Reach',
    tagline: 'Retain more customers, collect pending dues faster, and broadcast offers',
    icon: Users,
    accentColor: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    description:
      'Turn one-time shoppers into repeat loyalists. Manage your Udhar (credit ledger), send automated WhatsApp receipts, and execute targeted promotional campaigns.',
    highlights: [
      'Instant WhatsApp PDF invoice dispatch directly to customer’s phone upon checkout',
      'Digital Udhar (customer credit) ledger with credit limits and aging tracking',
      'Automated gentle WhatsApp reminders for overdue balances with instant UPI payment links',
      'Built-in loyalty point reward program with automatic discount redemption',
      'Festive broadcasts and targeted discount vouchers for Diwali, New Year, and birthdays',
      'Comprehensive customer purchase history and average order value (AOV) analytics',
    ],
    metric: {
      value: '40%',
      label: 'Faster Udhar credit recovery turnaround',
    },
  },
  {
    id: 'inventory',
    title: 'Smart Multi-Location Inventory',
    badge: 'Zero Dead Stock',
    tagline: 'Track stock across stores, godowns, and warehouses with batch & expiry controls',
    icon: Boxes,
    accentColor: 'from-violet-500/20 to-purple-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400',
    description:
      'Prevent stockouts and eliminate expired inventory. Manage multiple godowns, track batches, generate custom barcodes, and automate replenishment.',
    highlights: [
      'Real-time multi-godown stock synchronization with automated stock transfer notes (STN)',
      'Batch number and expiry date tracking with FEFO (First-Expired, First-Out) shelf suggestions',
      'Automated low-stock WhatsApp alerts and one-click purchase order (PO) generation',
      'Built-in barcode & QR code generator with printable sticker label templates',
      'Stock adjustment, wastage tracking, and physical stock audit reconciliation',
      'Item variants support (size, color, weight, packaging type)',
    ],
    metric: {
      value: '18%',
      label: 'Average margin savings from reduced spoilage',
    },
  },
  {
    id: 'hrms',
    title: 'HRMS, Attendance & Commission',
    badge: 'Team Accountability',
    tagline: 'Mobile geofenced attendance, shift management, and automated sales commissions',
    icon: Clock,
    accentColor: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
    description:
      'Keep your workforce organized without paying for a separate expensive HR tool. Track cashier shifts, calculate sales incentives, and secure sensitive pricing data.',
    highlights: [
      'Mobile GPS geofenced punch-in / punch-out and biometric device API sync',
      'Granular role-based security: prevent cashiers from viewing supplier purchase prices or margins',
      'Automated staff sales commission calculation based on bill value or target thresholds',
      'Monthly staff attendance calendar, leave requests, and overtime tracking',
      'One-click salary slip generation with advances and deduction breakdowns',
      'Audit log tracking every discount given, voided bill, and inventory modification',
    ],
    metric: {
      value: '100%',
      label: 'Audit trail on every staff price override',
    },
  },
  {
    id: 'accounting',
    title: 'Automated Accounting & Cash Flow',
    badge: 'Chartered Accountant Ready',
    tagline: 'Real-time Profit & Loss, balance sheets, and dedicated CA guest portal',
    icon: LineChart,
    accentColor: 'from-cyan-500/20 to-teal-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
    description:
      'Stop waiting till month-end to know your actual profit. Automated double-entry bookkeeping turns every POS bill, expense, and purchase into real-time financial statements.',
    highlights: [
      'Real-time Profit & Loss (P&L), Balance Sheet, and Trial Balance reports',
      'Accounts receivable and payable aging reports to monitor upcoming cash flow',
      'Bank statement CSV import with intelligent rule-based reconciliation',
      'Dedicated read-only Chartered Accountant (CA) portal access for hassle-free audit reviews',
      'Expense categorisation with vendor bills and tax receipt attachments',
      'Cash flow forecasting based on historical sales and recurring commitments',
    ],
    metric: {
      value: '15 min',
      label: 'Month-end audit preparation time',
    },
  },
]

const COMPARISON_ROWS = [
  {
    feature: 'GST Invoicing & E-Way Bills',
    bill2crm: 'Included (Native & Auto-synced)',
    fragmented: 'Tally / Busy (₹18k-36k + AMC)',
  },
  {
    feature: 'High-Speed POS & Barcode Billing',
    bill2crm: 'Included (Offline-first & Thermal print)',
    fragmented: 'Petpooja / Posist (₹15k-25k/yr)',
  },
  {
    feature: 'Customer CRM & WhatsApp Automation',
    bill2crm: 'Included (Direct WhatsApp Cloud API)',
    fragmented: 'Wati / Interakt (₹12k-24k/yr)',
  },
  {
    feature: 'Multi-Warehouse & Expiry Tracking',
    bill2crm: 'Included (FEFO + Auto Reorders)',
    fragmented: 'Zoho Inventory (₹12k-18k/yr)',
  },
  {
    feature: 'Staff Attendance & Commissions',
    bill2crm: 'Included (GPS Mobile + Biometric)',
    fragmented: 'Keka / GreytHR (₹10k-20k/yr)',
  },
  {
    feature: 'CA Direct Access & Financials',
    bill2crm: 'Included (Dedicated guest login)',
    fragmented: 'Manual Excel exports & emailing backups',
  },
  {
    feature: 'Total Estimated Cost',
    bill2crm: 'From ₹999/month (All-in-one)',
    fragmented: '₹67,000 - ₹1,20,000+ per year',
  },
  {
    feature: 'Data Synchronization',
    bill2crm: 'Instant real-time 1-second sync',
    fragmented: 'Manual copy-paste & CSV imports',
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/50 via-background to-background pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3.5 py-1 text-xs font-medium text-primary shadow-xs">
              <Sparkles className="size-3.5" />
              <span>Enterprise Power · SME Simplicity</span>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-balance">
              The Complete Operating System for{' '}
              <span className="bg-gradient-to-r from-primary via-emerald-600 to-[#138808] bg-clip-text text-transparent">
                Indian Commerce
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed text-pretty">
              Say goodbye to fragmented subscriptions, broken data silos, and expensive legacy accounting tools.
              Bill2CRM unites your billing counter, warehouse, customers, staff, and tax filings in one cohesive engine.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Button asChild size="lg" className="bg-[#138808] hover:bg-[#16a34a] text-white font-semibold shadow-md px-6">
                <Link to="/signup">
                  Start 7-Day Free Trial
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-border/80">
                <Link to="/pricing">View Pricing Plans</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#138808]" /> No credit card needed
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#138808]" /> 100% Data Sovereignty
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#138808]" /> Works Offline
              </span>
            </div>
          </div>

          {/* Quick Jump Pills */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2 border-t border-border/60 pt-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mr-1">
              Explore:
            </span>
            {PILLARS.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-surface-muted transition-colors"
              >
                {p.title.split('&')[0].trim()}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 6 Core Feature Deep Dives */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-5 space-y-24 sm:space-y-32">
          {PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon
            const isReversed = idx % 2 === 1

            return (
              <div
                key={pillar.id}
                id={pillar.id}
                className={`grid items-center gap-10 lg:grid-cols-12 ${
                  isReversed ? 'lg:grid-flow-dense' : ''
                }`}
              >
                {/* Text Content */}
                <div className={`lg:col-span-6 ${isReversed ? 'lg:col-start-7' : ''}`}>
                  <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                    <Icon className="size-3.5" />
                    <span>{pillar.badge}</span>
                  </div>

                  <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl text-foreground">
                    {pillar.title}
                  </h2>

                  <p className="mt-2 text-sm sm:text-base font-medium text-primary">
                    {pillar.tagline}
                  </p>

                  <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {pillar.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#138808]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex items-center gap-4 pt-6 border-t border-border/70">
                    <div className="rounded-xl border border-border bg-surface px-4 py-2.5 shadow-2xs">
                      <span className="text-xl sm:text-2xl font-bold text-foreground font-mono">
                        {pillar.metric.value}
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {pillar.metric.label}
                      </p>
                    </div>

                    <Button asChild variant="outline" size="sm" className="border-border">
                      <Link to="/signup">
                        Try this feature
                        <ArrowRight className="ml-1.5 size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Feature Card / Visual Illustration */}
                <div className={`lg:col-span-6 ${isReversed ? 'lg:col-start-1' : ''}`}>
                  <div className="relative rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-muted p-6 sm:p-8 shadow-sm">
                    <div className="absolute top-4 right-4 text-xs font-mono text-muted-foreground/60">
                      Module 0{idx + 1}
                    </div>

                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <Icon className="size-6" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{pillar.title}</div>
                        <div className="text-xs text-muted-foreground">Bill2CRM Enterprise Core</div>
                      </div>
                    </div>

                    {/* Interactive UI Mock Mini Widget */}
                    <div className="space-y-3 rounded-xl border border-border/80 bg-background/80 p-4 shadow-inner">
                      <div className="flex items-center justify-between text-xs font-medium border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Status &amp; Verification</span>
                        <span className="flex items-center gap-1 text-[#138808]">
                          <span className="size-1.5 rounded-full bg-[#138808]" />
                          Operational
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-surface p-2.5 border border-border/60">
                          <span className="text-[10px] text-muted-foreground block uppercase">Latency</span>
                          <span className="font-mono font-semibold text-foreground">0.08 ms local</span>
                        </div>
                        <div className="rounded-lg bg-surface p-2.5 border border-border/60">
                          <span className="text-[10px] text-muted-foreground block uppercase">Data Mode</span>
                          <span className="font-mono font-semibold text-foreground">Offline + Cloud Sync</span>
                        </div>
                      </div>

                      <div className="rounded-lg bg-surface p-3 border border-border/60 text-xs text-muted-foreground leading-snug">
                        <span className="font-semibold text-foreground block mb-1">Seamless Indian Workflow</span>
                        Every transaction auto-generates compliant tax documents, deducts physical warehouse stock, and logs customer activity.
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-primary" /> ISO &amp; GST Compliant
                      </span>
                      <span className="font-mono text-[11px]">#VocalForLocal</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Real-time Sync Engine: "One Entry Everywhere" */}
      <section className="border-t border-b border-border bg-surface-muted/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="border-primary/40 text-primary font-mono text-xs">
              Unified Data Engine
            </Badge>
            <h2 className="mt-3 text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
              One Entry Everywhere. Zero Double-Work.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              In traditional setups, your cashier bills in one app, stock is updated in another, and accounts are handled in a third.
              In Bill2CRM, a single action triggers a real-time chain reaction across all business units.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold mb-3">
                1
              </div>
              <h3 className="font-semibold text-foreground text-sm">Scan at Counter</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Cashier scans barcode at POS. Price, tax slabs, and discounts populate in 0.5 seconds.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold mb-3">
                2
              </div>
              <h3 className="font-semibold text-foreground text-sm">Instant Stock Deduction</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Warehouse inventory reduces instantly. If batch is near expiry, FEFO prioritizes it.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold mb-3">
                3
              </div>
              <h3 className="font-semibold text-foreground text-sm">WhatsApp &amp; Udhar Sync</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Digital invoice lands on customer’s phone. Any pending balance updates their credit ledger.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold mb-3">
                4
              </div>
              <h3 className="font-semibold text-foreground text-sm">Live P&amp;L &amp; GST Ready</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                GSTR-1 ledger records the sale. Business owner sees live gross profit increase on mobile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Fragmentation Trap: Comparison Matrix */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
              Bill2CRM vs The Fragmented SaaS Trap
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Why pay for 5 different software tools and waste hours copy-pasting spreadsheets when you can have one unified platform?
            </p>
          </div>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-surface shadow-xs">
            <table className="w-full min-w-[620px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60">
                  <th className="p-4 font-semibold text-muted-foreground">Capability</th>
                  <th className="p-4 font-bold text-foreground bg-primary-soft/30 text-primary">
                    Bill2CRM (All-in-One)
                  </th>
                  <th className="p-4 font-semibold text-muted-foreground">
                    Buying Separate Standalone Tools
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-border last:border-0 ${
                      idx === COMPARISON_ROWS.length - 2
                        ? 'bg-primary-soft/10 font-semibold'
                        : 'hover:bg-surface-muted/30'
                    }`}
                  >
                    <td className="p-4 font-medium text-foreground">{row.feature}</td>
                    <td className="p-4 text-foreground bg-primary-soft/20 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-[#138808] shrink-0" />
                      <span>{row.bill2crm}</span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                        <span>{row.fragmented}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="border-t border-border bg-gradient-to-b from-background to-surface-muted py-16 sm:py-20 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-5">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            Ready to upgrade your business operations?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Join thousands of forward-thinking Indian retailers, distributors, and SMEs who run on Bill2CRM.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Button asChild size="lg" className="bg-[#138808] hover:bg-[#16a34a] text-white font-semibold shadow-md px-8">
              <Link to="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-border">
              <Link to="/pricing">Calculate Custom Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

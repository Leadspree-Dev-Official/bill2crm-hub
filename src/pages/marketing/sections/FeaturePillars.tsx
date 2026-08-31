import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { SectionHead } from './SectionHead'

interface Pillar {
  eyebrow: string
  title: string
  desc: string
  bullets: string[]
  mock: ReactNode
}

const PILLARS: Pillar[] = [
  {
    eyebrow: 'Billing & e-Signatures',
    title: 'GST invoicing, proposals and signed agreements',
    desc: 'Auto CGST/SGST/IGST with HSN lookup, dynamic UPI QR codes, and legally sealed digital signatures — all sent over WhatsApp, email or SMS in one click.',
    bullets: ['Recurring bills, credit notes & milestones', 'Proposal → Agreement → Invoice in one click', 'Expiring secure document links'],
    mock: <InvoiceMock />,
  },
  {
    eyebrow: 'POS & Restaurant Floor',
    title: 'Instant billing, table floor plans & kitchen tickets',
    desc: 'A touchscreen-ready checkout for retail counters, plus a full restaurant floor plan with automated, deduplicated KOTs and table-side QR ordering.',
    bullets: ['Multi-tender payments — cash, card, UPI, split', 'Live table status & reservation holds', 'Works offline, syncs when reconnected'],
    mock: <PosMock />,
  },
  {
    eyebrow: 'Mini CRM & Follow-ups',
    title: 'Every lead and customer, followed up automatically',
    desc: 'A unified customer database with notes, tags and reminders — so payment and lead follow-ups happen on WhatsApp without you remembering to send them.',
    bullets: ['Auto-tagging: VIP, wholesale, repeat', 'Full transaction & interaction history', 'One-click CSV import & export'],
    mock: <CrmMock />,
  },
  {
    eyebrow: 'Inventory',
    title: 'Stock that updates itself, across every location',
    desc: 'Batch and expiry tracking, multi-warehouse transfers, and automatic stock deduction on every sale — with alerts before you run out.',
    bullets: ['Real-time deduction on POS & invoice sales', 'Low-stock reorder alerts', 'Full stock movement audit log'],
    mock: <InventoryMock />,
  },
  {
    eyebrow: 'HRMS & Payroll',
    title: 'Attendance, leave and payroll, without spreadsheets',
    desc: 'Check-in/out tracking, multi-tier leave approvals, and an automated payroll engine that emails PDF payslips — plus an AI assistant for HR questions.',
    bullets: ['Net pay = salary + allowances − deductions', 'Visual weekly/monthly shift rosters', 'Brands → branches → departments → teams'],
    mock: <PayrollMock />,
  },
  {
    eyebrow: 'Bookkeeping',
    title: 'Double-entry accounting that keeps itself in balance',
    desc: 'Every sale, expense and salary is posted automatically as a balanced ledger entry — with real-time P&L, Balance Sheet, and one-click Tally-ready export for your CA.',
    bullets: ['Standard Chart of Accounts', 'Real-time Trial Balance & P&L', 'Tally-compatible XML export'],
    mock: <LedgerMock />,
  },
]

export function FeaturePillars() {
  return (
    <section id="features" className="relative border-b border-border px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Everything to bill & grow"
          title="Six modules. One synced business."
          desc="Every part of Bill2CRM shares the same customer, product and ledger data — nothing to export, import, or reconcile between tools."
        />
        <div className="space-y-16">
          {PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}
            >
              <div>
                <p className="eyebrow">{pillar.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-semibold">{pillar.title}</h3>
                <p className="mt-3 text-muted-foreground">{pillar.desc}</p>
                <ul className="mt-4 space-y-2">
                  {pillar.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">{pillar.mock}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function InvoiceMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="eyebrow">Tax Invoice #INV-0148</div>
          <div className="font-semibold">Sharma Traders</div>
        </div>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">Paid</span>
      </div>
      {[
        ['Consulting services', '₹18,500'],
        ['CGST + SGST (18%)', '₹3,330'],
      ].map(([l, a]) => (
        <div key={l} className="flex justify-between text-sm text-muted-foreground">
          <span>{l}</span>
          <span className="tabular font-medium text-foreground">{a}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-md bg-primary-soft px-3 py-2 text-xs font-medium text-primary">
        <span>UPI QR</span> attached — 1-click settlement
      </div>
    </div>
  )
}

function PosMock() {
  const floors = [
    { name: 'Floor 1', tables: ['V', 'S', 'R'] },
    { name: 'Floor 2', tables: ['S', 'B', 'V'] },
    { name: 'Floor 3', tables: ['R', 'V', 'S'] },
  ]
  const styles: Record<string, string> = {
    V: 'bg-muted text-muted-foreground',
    S: 'bg-warning/15 text-warning',
    R: 'bg-primary-soft text-primary',
    B: 'bg-accent-soft text-accent',
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Table layout</span>
        <span className="rounded-full bg-muted px-2 py-0.5">Live</span>
      </div>
      <div className="space-y-2.5">
        {floors.map((floor, fi) => (
          <div key={floor.name} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[11px] text-muted-foreground">{floor.name}</span>
            <div className="grid flex-1 grid-cols-3 gap-1.5">
              {floor.tables.map((t, i) => (
                <div
                  key={i}
                  className={`grid h-9 place-items-center rounded-md text-[11px] font-bold ${styles[t]}`}
                >
                  T{fi * 3 + i + 1}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">KOT #204</span> sent to kitchen — 2 new items
      </div>
    </div>
  )
}

function CrmMock() {
  const leads = [
    { name: 'Rahul Sharma', tag: 'VIP', note: 'Follow up tomorrow' },
    { name: 'Priya Traders', tag: 'Wholesale', note: 'Payment reminder sent' },
    { name: 'Amit Kumar', tag: 'New lead', note: 'Call scheduled' },
  ]
  return (
    <div className="space-y-2">
      {leads.map((l) => (
        <div key={l.name} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold">{l.name}</div>
            <div className="text-xs text-muted-foreground">{l.note}</div>
          </div>
          <span className="rounded-full bg-primary-soft px-2 py-1 text-[10px] font-semibold text-primary">
            {l.tag}
          </span>
        </div>
      ))}
    </div>
  )
}

function InventoryMock() {
  const items = [
    { name: 'Basmati Rice 25kg', pct: 12, status: 'low' },
    { name: 'Sunflower Oil 1L', pct: 68, status: 'ok' },
    { name: 'Wheat Flour 10kg', pct: 45, status: 'ok' },
  ]
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.name}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-foreground">{it.name}</span>
            {it.status === 'low' ? (
              <span className="font-semibold text-destructive">Low stock</span>
            ) : (
              <span className="text-muted-foreground">{it.pct}%</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div
              className={`h-1.5 rounded-full ${it.status === 'low' ? 'bg-destructive' : 'bg-accent'}`}
              style={{ width: `${it.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function PayrollMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Present today</span>
        <span className="font-semibold">24 / 26</span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Leave requests pending</span>
        <span className="font-semibold text-warning">3</span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-accent-soft px-3 py-2.5 text-sm">
        <span className="text-accent">Payslips generated</span>
        <span className="font-semibold text-accent">26 ✓</span>
      </div>
    </div>
  )
}

function LedgerMock() {
  const bars = [40, 55, 48, 62, 58, 70, 66, 78]
  return (
    <div>
      <div className="mb-3 flex items-end gap-1.5" style={{ height: 72 }}>
        {bars.map((b, i) => (
          <div key={i} className="flex-1 rounded-t bg-primary/25" style={{ height: `${b}%` }} />
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Net Profit (MTD)</span>
        <span className="tabular font-semibold text-accent">₹2,84,600</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs font-medium text-muted-foreground">
        Export to Tally XML
      </div>
    </div>
  )
}

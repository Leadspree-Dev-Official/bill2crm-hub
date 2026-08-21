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
    <section id="features" className="relative px-5 py-20">
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
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{pillar.eyebrow}</span>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">{pillar.title}</h3>
                <p className="mt-3 text-slate-500">{pillar.desc}</p>
                <ul className="mt-4 space-y-2">
                  {pillar.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{pillar.mock}</div>
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
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="text-xs text-slate-400">Tax Invoice #INV-0148</div>
          <div className="font-bold text-slate-900">Sharma Traders</div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Paid</span>
      </div>
      {[
        ['Consulting services', '₹18,500'],
        ['CGST + SGST (18%)', '₹3,330'],
      ].map(([l, a]) => (
        <div key={l} className="flex justify-between text-sm text-slate-500">
          <span>{l}</span>
          <span className="font-medium text-slate-800">{a}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
        <span>📱 UPI QR</span> attached — 1-click settlement
      </div>
    </div>
  )
}

function PosMock() {
  const tables = ['V', 'S', 'S', 'R', 'V', 'B', 'S', 'V', 'R']
  const styles: Record<string, string> = {
    V: 'bg-slate-100 text-slate-400',
    S: 'bg-amber-100 text-amber-700',
    R: 'bg-indigo-100 text-indigo-700',
    B: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>Floor 1 — Table layout</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5">Live</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tables.map((t, i) => (
          <div key={i} className={`grid aspect-square place-items-center rounded-lg text-xs font-bold ${styles[t]}`}>
            T{i + 1}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">KOT #204</span> sent to kitchen — 2 new items
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
        <div key={l.name} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold text-slate-800">{l.name}</div>
            <div className="text-xs text-slate-400">{l.note}</div>
          </div>
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-600">
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
            <span className="text-slate-600">{it.name}</span>
            {it.status === 'low' ? (
              <span className="font-semibold text-red-500">Low stock</span>
            ) : (
              <span className="text-slate-400">{it.pct}%</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-slate-100">
            <div
              className={`h-1.5 rounded-full ${it.status === 'low' ? 'bg-red-400' : 'bg-emerald-400'}`}
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
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
        <span className="text-slate-600">Present today</span>
        <span className="font-bold text-slate-900">24 / 26</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
        <span className="text-slate-600">Leave requests pending</span>
        <span className="font-bold text-amber-600">3</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5 text-sm">
        <span className="text-emerald-700">Payslips generated</span>
        <span className="font-bold text-emerald-700">26 ✓</span>
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
          <div key={i} className="flex-1 rounded-t bg-indigo-200" style={{ height: `${b}%` }} />
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
        <span className="text-slate-500">Net Profit (MTD)</span>
        <span className="font-bold text-emerald-600">₹2,84,600</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
        📤 Export to Tally XML
      </div>
    </div>
  )
}

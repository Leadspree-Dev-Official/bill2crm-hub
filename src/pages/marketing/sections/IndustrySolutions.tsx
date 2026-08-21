import { SectionHead } from './SectionHead'

const INDUSTRIES = [
  {
    icon: '🍽️',
    title: 'Restaurants, Cafes & Cloud Kitchens',
    desc: 'Table floor plans, deduplicated KOTs, delivery Kanban, and QR-code table ordering.',
    tags: ['Tables', 'KOT', 'Delivery board', 'QR menu'],
  },
  {
    icon: '🛍️',
    title: 'Retailers, Supermarkets & Wholesalers',
    desc: 'Barcode POS checkout, batch & expiry tracking, and GST-ready bills at the counter.',
    tags: ['Barcode POS', 'Batch/expiry', 'Inventory', 'GST bills'],
  },
  {
    icon: '💼',
    title: 'Agencies, Consultants & Freelancers',
    desc: 'Win work with proposals, close it with signed agreements, and bill it in milestones.',
    tags: ['Proposals', 'e-Sign agreements', 'Milestone billing', 'Mini CRM'],
  },
  {
    icon: '💇',
    title: 'Salons, Spas & Healthcare Clinics',
    desc: 'Appointment booking with consultant assignment, automated reminders, and fast checkout.',
    tags: ['Appointments', 'Consultant assignment', 'Reminders', 'Fast checkout'],
  },
  {
    icon: '🏗️',
    title: 'Contractors, Interior Designers & Traders',
    desc: 'Quote big jobs, track materials as stock, log expenses, and bill in installments.',
    tags: ['Quotes', 'Materials/stock', 'Expense tracking', 'Installments'],
  },
]

export function IndustrySolutions() {
  return (
    <section id="industries" className="relative bg-slate-50 px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Built for your business"
          title="Presets tuned to how your industry actually works"
          desc="Turn on the modules that matter for you — Bill2CRM adapts its screens to your industry instead of showing you everything at once."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((ind) => (
            <div key={ind.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-xl">{ind.icon}</span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{ind.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{ind.desc}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {ind.tags.map((t) => (
                  <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-col items-start justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6">
            <h3 className="text-base font-bold text-slate-900">Something else?</h3>
            <p className="mt-2 text-sm text-slate-500">
              If you send invoices and follow up with customers, Bill2CRM fits — across trades and services.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

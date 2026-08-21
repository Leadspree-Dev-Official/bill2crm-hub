import { SectionHead } from './SectionHead'

const NODES = [
  { label: 'Invoicing', x: 18, y: 18 },
  { label: 'POS', x: 82, y: 16 },
  { label: 'Mini CRM', x: 10, y: 55 },
  { label: 'Inventory', x: 90, y: 58 },
  { label: 'HRMS', x: 24, y: 88 },
  { label: 'Accounting', x: 76, y: 88 },
]

const PROBLEMS = [
  {
    n: '01',
    title: 'Paying for 6 Tools',
    desc: 'Separate subscriptions for invoicing, POS, CRM, HR and accounting software — each with its own login, its own bill.',
  },
  {
    n: '02',
    title: 'Manual Double-Entry',
    desc: "Every sale and expense gets typed into your books by hand, then typed again for your CA at filing time.",
  },
  {
    n: '03',
    title: 'Missed Follow-Ups',
    desc: 'Leads go cold and payments go unpaid because nothing reminds you — it all lives in someone\'s memory or WhatsApp.',
  },
]

export function ProblemSolution() {
  return (
    <section className="relative bg-slate-50 px-5 py-20">
      <div className="mx-auto max-w-4xl">
        <SectionHead
          eyebrow="The problem"
          title="Your business is one thing. Your software is six."
          desc="Most growing Indian businesses stitch together separate apps for billing, customers, stock, staff and accounts — and none of them talk to each other."
        />

        <div className="relative mx-auto mb-16 h-72 max-w-xl sm:h-80">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            {NODES.map((node) => (
              <line
                key={node.label}
                x1={50}
                y1={50}
                x2={node.x}
                y2={node.y}
                stroke="#c7d2fe"
                strokeWidth="0.6"
                strokeDasharray="2,2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-center shadow-lg">
            <div className="text-sm font-bold text-white">Your Business</div>
            <div className="text-[11px] text-slate-400">but everything lives apart</div>
          </div>
          {NODES.map((node) => (
            <div
              key={node.label}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              {node.label}
            </div>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="text-2xl font-extrabold text-indigo-200">{p.n}</span>
              <h3 className="mt-2 text-base font-bold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

import { Database, Lock, ShieldCheck } from 'lucide-react'
import { SectionHead } from './SectionHead'

const POINTS = [
  {
    icon: Database,
    title: 'Shared or dedicated — your choice',
    desc: 'Start on shared Cloud SaaS, or move to a dedicated private Supabase database with your own isolated project.',
  },
  {
    icon: Lock,
    title: 'Zero data lock-in',
    desc: 'Export your full workspace as a ZIP backup any time, or your ledger as Tally-ready XML — your data is never held hostage.',
  },
  {
    icon: ShieldCheck,
    title: 'Encrypted legal vault',
    desc: 'Contracts, agreements and sensitive documents live in an encrypted vault with plan-based storage limits.',
  },
]

export function DataOwnership() {
  return (
    <section className="relative px-5 py-20">
      <div className="mx-auto max-w-5xl">
        <SectionHead
          eyebrow="Private Cloud"
          title="Own your business data — not just rent access to it"
          desc="Privacy-conscious businesses choose Bill2CRM's Private Cloud plan for a dedicated database that's isolated from every other tenant."
        />
        <div className="grid gap-5 sm:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <p.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

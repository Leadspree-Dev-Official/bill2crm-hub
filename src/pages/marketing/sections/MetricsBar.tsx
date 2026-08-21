const METRICS = [
  ['99.9%', 'Uptime'],
  ['₹0', 'Transaction surcharges'],
  ['10x', 'Faster invoicing'],
  ['100%', 'CA-ready (Tally export)'],
] as const

export function MetricsBar() {
  return (
    <section className="relative border-y border-slate-100 bg-slate-50/60 px-5 py-8">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
        {METRICS.map(([value, label]) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{value}</div>
            <div className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

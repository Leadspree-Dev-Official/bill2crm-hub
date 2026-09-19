// "99.9% Uptime" was stated as a measured figure while nothing was monitoring
// availability. Phrased as the target it actually is until a status page backs
// the number up. "10x faster invoicing" is likewise a claim, not a benchmark —
// keep it out until there is something to cite.
const METRICS = [
  ['99.9%', 'Uptime target'],
  ['₹0', 'Transaction surcharges'],
  ['7 days', 'Free trial, no card'],
  ['100%', 'CA-ready (Tally export)'],
] as const

export function MetricsBar() {
  return (
    <section className="relative border-b border-border bg-surface/40 px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
        {METRICS.map(([value, label], idx) => (
          <div key={label} className="text-center">
            <div
              className={`tabular font-display text-2xl font-bold sm:text-3xl ${
                idx % 2 === 0 ? 'text-[#FF6E14]' : 'text-[#138808] dark:text-[#16a34a]'
              }`}
            >
              {value}
            </div>
            <div className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

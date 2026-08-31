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
    <section className="relative border-b border-border bg-surface px-5 py-8">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
        {METRICS.map(([value, label]) => (
          <div key={label} className="text-center">
            <div className="tabular font-display text-2xl font-semibold sm:text-3xl">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

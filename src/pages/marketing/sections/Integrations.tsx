import { SectionHead } from './SectionHead'

const INTEGRATIONS = [
  ['💬', 'WhatsApp'],
  ['✉️', 'Email'],
  ['📱', 'SMS'],
  ['⚡', 'Zapier'],
  ['🔗', 'Make'],
  ['🧩', 'n8n'],
  ['📊', 'Tally XML'],
]

export function Integrations() {
  return (
    <section className="relative bg-slate-50 px-5 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <SectionHead
          eyebrow="Integrations"
          title="Connects to the tools you already use"
          desc="Out-of-the-box messaging, and no-code webhook automation for everything else — no API key required in your own code."
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          {INTEGRATIONS.map(([icon, label]) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              <span>{icon}</span> {label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Paste a webhook URL from Zapier, Make or n8n into Settings → Integrations — Bill2CRM sends an event every
          time a record changes. No secret keys ever appear in your code.
        </p>
      </div>
    </section>
  )
}

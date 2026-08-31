import { SectionHead } from './SectionHead'

const INTEGRATIONS = ['WhatsApp', 'Email', 'SMS', 'Zapier', 'Make', 'n8n', 'Tally XML']

export function Integrations() {
  return (
    <section className="relative border-b border-border bg-surface px-5 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <SectionHead
          eyebrow="Integrations"
          title="Connects to the tools you already use"
          desc="Out-of-the-box messaging, and no-code webhook automation for everything else — no API key required in your own code."
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          {INTEGRATIONS.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium"
            >
              {label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Paste a webhook URL from Zapier, Make or n8n into Settings → Integrations — Bill2CRM sends an event every
          time a record changes. No secret keys ever appear in your code.
        </p>
      </div>
    </section>
  )
}

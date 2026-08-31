import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { SectionHead } from './SectionHead'

export function WhyChoose() {
  return (
    <section className="relative border-b border-border px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="Why Bill2CRM"
          title="Everything you need, actually working together"
          desc="Not six subscriptions bolted together — one workspace where every module already knows about the others."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <MiniSyncFlow />
            <h3 className="mt-5 text-lg font-semibold">Everything Syncs Automatically</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A POS sale updates stock, posts to your double-entry ledger, and logs the customer in CRM — all in
              the same instant, with nothing to reconcile by hand.
            </p>
          </Card>
          <Card>
            <MiniAppGrid />
            <h3 className="mt-5 text-lg font-semibold">One Platform, Every Module</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Invoicing, POS, mini CRM, inventory, HRMS and bookkeeping — built as one product, not integrated
              afterwards. Turn on only the modules your business actually needs.
            </p>
          </Card>
          <Card>
            <MiniAutomationStack />
            <h3 className="mt-5 text-lg font-semibold">Automate the Busywork</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Automated WhatsApp payment reminders, low-stock alerts, and appointment nudges — so nothing falls
              through the cracks while you focus on customers.
            </p>
          </Card>
        </div>
      </div>
    </section>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-border bg-surface p-6">{children}</div>
}

function MiniSyncFlow() {
  const steps = ['POS Sale', 'Ledger', 'CRM']
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-4 py-5">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold">{s}</span>
          {i < steps.length - 1 && <ArrowRight className="size-3.5 text-primary/60" />}
        </div>
      ))}
    </div>
  )
}

function MiniAppGrid() {
  const apps = ['🧾', '🛒', '👥', '📦', '🧑‍💼', '📊']
  return (
    <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface-muted p-4">
      {apps.map((a, i) => (
        <div
          key={i}
          className="grid aspect-square place-items-center rounded-md border border-border bg-surface text-lg"
        >
          {a}
        </div>
      ))}
    </div>
  )
}

function MiniAutomationStack() {
  const items = ['Payment reminder sent', 'Low-stock alert triggered', 'Appointment reminder queued']
  return (
    <div className="space-y-2 rounded-md border border-border bg-surface-muted p-4">
      {items.map((t) => (
        <div
          key={t}
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs"
        >
          <CheckCircle2 className="size-3.5 shrink-0 text-accent" />
          <span className="text-muted-foreground">{t}</span>
        </div>
      ))}
    </div>
  )
}

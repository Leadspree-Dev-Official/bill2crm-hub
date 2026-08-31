import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { BrandLock } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'

const ASSURANCES = [
  '7-day free trial, no card required',
  'Your own instance and subdomain',
  'Data stays in India (ap-south region)',
  'Cancel or export at any time',
]

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <BrandLock />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-12">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to site
        </Link>
      </div>

      <aside className="relative hidden border-l border-border bg-surface-muted lg:flex lg:flex-col lg:justify-center">
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative px-14">
          <p className="eyebrow">Account & billing</p>
          <p className="mt-4 max-w-md font-display text-2xl font-medium leading-snug">
            This is the control plane for your Bill2CRM instance — signup, plan, limits and access. The billing
            counter itself lives in your app.
          </p>
          <ul className="mt-8 space-y-3">
            {ASSURANCES.map((a) => (
              <li key={a} className="flex gap-2.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                {a}
              </li>
            ))}
          </ul>
          <p className="mt-10 font-mono text-[11px] text-muted-foreground">support@bill2crm.in</p>
        </div>
      </aside>
    </div>
  )
}

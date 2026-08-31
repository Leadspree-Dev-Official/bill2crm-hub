import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 5h11l5 5v9H4z" strokeLinejoin="round" />
        <path d="M8 10h6M8 14h8" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function BrandLock({
  to = '/',
  suffix,
  className,
}: {
  to?: string
  suffix?: string
  className?: string
}) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="font-display text-[15px] font-semibold tracking-tight">
        Bill2CRM
        {suffix ? (
          <span className="ml-1.5 font-mono text-[11px] font-normal tracking-normal text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
    </Link>
  )
}

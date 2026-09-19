import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#138808] font-display font-bold text-white text-sm shadow-sm ring-1 ring-white/10',
        className,
      )}
      aria-hidden
    >
      B2
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
      <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
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

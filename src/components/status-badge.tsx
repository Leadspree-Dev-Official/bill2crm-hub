import type { TenantStatus } from '@/types/database'
import { STATUS_LABEL } from '@/lib/plan-utils'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<TenantStatus, string> = {
  trial: 'border-info/40 bg-info/10 text-info',
  active: 'border-accent/40 bg-accent/10 text-accent',
  free: 'border-border-strong bg-muted text-muted-foreground',
  past_due: 'border-warning/40 bg-warning/10 text-warning',
  suspended: 'border-destructive/40 bg-destructive/10 text-destructive',
  cancelled: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export function StatusBadge({ status, className }: { status: TenantStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide',
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  )
}

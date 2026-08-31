import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminAuditLogEntry } from '@/types/database'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { Loader2 } from 'lucide-react'

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setEntries((data as AdminAuditLogEntry[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Audit log" description="Every mutating admin action, most recent first." />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          {entries.map((entry) => (
            <div key={entry.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[9rem_10rem_1fr]">
              <span className="font-mono text-[11px] text-muted-foreground">
                {new Date(entry.created_at).toLocaleString('en-IN')}
              </span>
              <span className="rounded-sm border border-border-strong bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground w-fit">
                {entry.action}
              </span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">{JSON.stringify(entry.payload)}</span>
            </div>
          ))}
          {entries.length === 0 && <p className="px-4 py-10 text-center text-muted-foreground">No admin actions yet.</p>}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AppNav } from '@/components/app-nav'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/admin', label: 'Tenants', end: true },
  { to: '/admin/upgrade-requests', label: 'Upgrade requests' },
  { to: '/admin/app-links', label: 'App links' },
  { to: '/admin/plans', label: 'Plans' },
  { to: '/admin/audit-log', label: 'Audit log' },
  { to: '/admin/super-admins', label: 'Super admins' },
]

export default function AdminLayout() {
  const { user } = useAuth()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    supabase
      .from('upgrade_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'contacted'])
      .then(({ count }) => setPending(count ?? 0))
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background text-[13px]">
      <AppNav suffix="control-plane" />
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-2.5">
          <span className="rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-destructive">
            super-admin
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{user?.email}</span>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-0 overflow-x-auto px-4">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'border-primary text-foreground',
                )
              }
            >
              {tab.label}
              {tab.to === '/admin/upgrade-requests' && pending > 0 ? (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {pending}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

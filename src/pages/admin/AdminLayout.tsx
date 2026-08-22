import { NavLink, Outlet } from 'react-router-dom'
import { AppNav } from '@/components/app-nav'
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
  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <AppNav title="Bill2CRM Admin" />
      <div className="border-b bg-background">
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'border-primary text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

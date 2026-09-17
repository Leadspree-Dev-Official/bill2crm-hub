import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  ExternalLink,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  ScrollText,
  Server,
  ShieldHalf,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { BrandLock } from '@/components/brand'
import { StatusBadge } from '@/components/status-badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { UPGRADE_REQUESTS_EVENT, useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Match the path exactly rather than by prefix — for index routes like /admin. */
  end?: boolean
}

const workspaceNav: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/upgrade', label: 'Plan & upgrade', icon: ArrowUpRight, end: true },
]

const controlPanelNav: NavItem[] = [
  { to: '/admin', label: 'Tenants', icon: Building2, end: true },
  { to: '/admin/upgrade-requests', label: 'Upgrade requests', icon: TrendingUp },
  { to: '/admin/app-links', label: 'App links', icon: Server },
  { to: '/admin/plans', label: 'Plans', icon: CreditCard },
]

const governanceNav: NavItem[] = [
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { to: '/admin/super-admins', label: 'Super admins', icon: ShieldHalf },
]

/** Pending upgrade requests, badged on the admin nav. Super-admin only: the table is
 *  RLS-locked, so there is nothing to fetch for an ordinary tenant user. */
function usePendingUpgradeRequests(enabled: boolean) {
  const [pending, setPending] = useState(0)

  const check = useCallback(() => {
    if (!enabled) return
    supabase
      .from('upgrade_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'contacted'])
      .then(({ count }) => setPending(count ?? 0))
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setPending(0)
      return
    }
    check()
    if (typeof window !== 'undefined') {
      window.addEventListener(UPGRADE_REQUESTS_EVENT, check)
      window.addEventListener('focus', check)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(UPGRADE_REQUESTS_EVENT, check)
        window.removeEventListener('focus', check)
      }
    }
  }, [enabled, check])

  // Derived rather than reset in the effect, so losing the grant clears the badge
  // without a second render pass.
  return enabled ? pending : 0
}

function AppSidebar({ pending }: { pending: number }) {
  const { appBaseUrl, isSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const instanceUrl = appBaseUrl
  const inAdmin = pathname.startsWith('/admin')

  const isActive = (item: NavItem) => (item.end ? pathname === item.to : pathname.startsWith(item.to))

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.to}>
      <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
        <Link to={item.to}>
          <item.icon className="size-4" />
          <span>{item.label}</span>
          {item.to === '/admin/upgrade-requests' && pending > 0 ? (
            <span className="ml-auto shrink-0 rounded-sm bg-sidebar-accent px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-sidebar-foreground/80">
              {pending}
            </span>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <BrandLock to="/dashboard" suffix={inAdmin ? 'control-panel' : 'workspace'} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map(renderItem)}
              {instanceUrl ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Open instance">
                    <a href={instanceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                      <span>Open instance</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Main website">
                  <Link to="/" target="_blank" rel="noopener noreferrer">
                    <Globe className="size-4" />
                    <span>Main website</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Control panel</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{controlPanelNav.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Governance</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{governanceNav.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Support on WhatsApp">
              <a href="https://wa.me/919051822558" target="_blank" rel="noopener noreferrer">
                <LifeBuoy className="size-4" />
                <span>Support</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

/** The single shell behind every signed-in surface — workspace and control panel alike.
 *  Both share one sidebar; only the header strip and the content measure differ. */
export function AppShell({ children }: { children: ReactNode }) {
  const { tenant, user, isSuperAdmin } = useAuth()
  const { pathname } = useLocation()
  const inAdmin = pathname.startsWith('/admin')
  const pending = usePendingUpgradeRequests(isSuperAdmin)

  return (
    <SidebarProvider>
      <div className={`app-canvas flex min-h-screen w-full bg-background ${inAdmin ? 'text-[13px]' : ''}`}>
        <AppSidebar pending={pending} />
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
            <SidebarTrigger className="text-muted-foreground" />
            {inAdmin ? (
              <>
                <span className="rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-destructive">
                  super-admin
                </span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">{user?.email}</span>
              </>
            ) : tenant ? (
              <>
                <p className="truncate text-sm font-medium">{tenant.business_name}</p>
                <StatusBadge status={tenant.status} />
              </>
            ) : null}
            <div className="ml-auto flex items-center gap-1.5">
              {inAdmin ? null : (
                <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                  <Link to="/dashboard/upgrade">Upgrade</Link>
                </Button>
              )}
              <ThemeToggle />
            </div>
          </header>
          {/* A div, not a <main>: SidebarInset already renders the <main> landmark. */}
          <div className={`mx-auto w-full flex-1 px-5 py-8 ${inAdmin ? 'max-w-6xl' : 'max-w-5xl'}`}>{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

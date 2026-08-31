import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, ExternalLink, LayoutDashboard, LifeBuoy, LogOut, ShieldHalf } from 'lucide-react'
import type { ReactNode } from 'react'

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
import { useAuth } from '@/lib/auth-context'
import { tenantAppUrl } from '@/lib/supabase'

const workspaceNav = [
  { title: 'Overview', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Plan & upgrade', url: '/dashboard/upgrade', icon: ArrowUpRight },
]

function WorkspaceSidebar() {
  const { tenant, isSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const instanceUrl = tenant ? tenantAppUrl(tenant.subdomain_slug) : null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <BrandLock to="/dashboard" suffix="workspace" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/admin')} tooltip="Admin console">
                    <Link to="/admin">
                      <ShieldHalf className="size-4" />
                      <span>Admin console</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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

export function DashboardShell({ children }: { children: ReactNode }) {
  const { tenant } = useAuth()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <WorkspaceSidebar />
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
            <SidebarTrigger className="text-muted-foreground" />
            {tenant ? (
              <>
                <p className="truncate text-sm font-medium">{tenant.business_name}</p>
                <StatusBadge status={tenant.status} />
              </>
            ) : null}
            <div className="ml-auto flex items-center gap-1.5">
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link to="/dashboard/upgrade">Upgrade</Link>
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl px-5 py-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

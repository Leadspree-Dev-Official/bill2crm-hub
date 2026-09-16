import { Outlet } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'

/** The control plane shares the workspace shell — one sidebar across the whole site.
 *  AppShell keys its header strip and content measure off the /admin path prefix. */
export default function AdminLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

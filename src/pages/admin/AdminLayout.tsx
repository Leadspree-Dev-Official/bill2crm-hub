import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { ErrorBoundary } from '@/components/error-boundary'

/** The control panel shares the workspace shell — one sidebar across the whole site.
 *  AppShell keys its header strip and content measure off the /admin path prefix. */
export default function AdminLayout() {
  return (
    <AppShell>
      <ErrorBoundary fallbackTitle="Control Panel encountered an error">
        <Outlet />
      </ErrorBoundary>
    </AppShell>
  )
}

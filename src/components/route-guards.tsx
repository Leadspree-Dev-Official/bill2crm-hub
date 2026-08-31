import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { Loader2 } from 'lucide-react'

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function RequireAuth() {
  const { session, loading, isPasswordRecovery } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />
  // A password-recovery session is only good for setting a new password — don't let it satisfy
  // "signed in" and drop the user straight into the dashboard before they've done that.
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function RequireSuperAdmin() {
  const { session, isSuperAdmin, loading, isPasswordRecovery } = useAuth()

  if (loading) return <FullScreenSpinner />
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (!session) return <Navigate to="/login" replace />
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { session, loading, isPasswordRecovery } = useAuth()
  if (loading) return <FullScreenSpinner />
  // Same reasoning as RequireAuth: a recovery session hitting /login or /signup should be routed
  // to set a new password, not bounced onward as if it were a normal authenticated visit.
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (session) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

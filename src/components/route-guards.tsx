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
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function RequireSuperAdmin() {
  const { session, isSuperAdmin, loading } = useAuth()

  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (session) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

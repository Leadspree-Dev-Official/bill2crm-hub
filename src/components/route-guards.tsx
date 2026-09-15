import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import {
  decideRedirectIfAuthed,
  decideRequireAuth,
  decideRequireSuperAdmin,
  type GuardState,
} from '@/lib/route-decision'
import { Loader2 } from 'lucide-react'

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/** The decisions themselves live in @/lib/route-decision as pure functions so they can be
 *  tested without a router or a DOM — see tests/route-guards.test.mjs. */
function useGuardState(): GuardState {
  const { session, isSuperAdmin, loading, isPasswordRecovery } = useAuth()
  return { loading, hasSession: Boolean(session), isSuperAdmin, isPasswordRecovery }
}

export function RequireAuth() {
  const outcome = decideRequireAuth(useGuardState())
  const location = useLocation()

  if (outcome.kind === 'spinner') return <FullScreenSpinner />
  if (outcome.kind === 'redirect') {
    // Only the sign-in bounce carries the return path; the others are terminal destinations.
    return outcome.to === '/login' ? (
      <Navigate to={outcome.to} replace state={{ from: location }} />
    ) : (
      <Navigate to={outcome.to} replace />
    )
  }
  return <Outlet />
}

export function RequireSuperAdmin() {
  const outcome = decideRequireSuperAdmin(useGuardState())

  if (outcome.kind === 'spinner') return <FullScreenSpinner />
  if (outcome.kind === 'redirect') return <Navigate to={outcome.to} replace />
  return <Outlet />
}

export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const outcome = decideRedirectIfAuthed(useGuardState())

  if (outcome.kind === 'spinner') return <FullScreenSpinner />
  if (outcome.kind === 'redirect') return <Navigate to={outcome.to} replace />
  return <>{children}</>
}

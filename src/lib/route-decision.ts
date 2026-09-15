/**
 * The routing decisions behind RequireAuth / RequireSuperAdmin / RedirectIfAuthed, as pure
 * functions of auth state.
 *
 * They live apart from the components so they can be tested directly. These three predicates
 * are the entire access-control boundary of the control-plane UI — everything behind /admin is
 * gated by nothing else on the client — and the ordering between them is load-bearing in a way
 * that is easy to get wrong: a recovery session is a real session, so any guard that checks
 * `session` before `isPasswordRecovery` will wave a half-authenticated user through to the
 * dashboard with their password still unchanged.
 *
 * The server does not depend on any of this. Every privileged read is behind RLS and every
 * privileged write is behind a SECURITY DEFINER RPC that re-checks is_super_admin() itself, so
 * defeating these guards changes what is drawn, not what can be reached.
 */

export interface GuardState {
  loading: boolean
  hasSession: boolean
  isSuperAdmin: boolean
  isPasswordRecovery: boolean
}

export type GuardOutcome =
  | { kind: 'spinner' }
  | { kind: 'allow' }
  | { kind: 'redirect'; to: '/login' | '/dashboard' | '/reset-password' }

/** Gate for any signed-in route. */
export function decideRequireAuth(state: GuardState): GuardOutcome {
  if (state.loading) return { kind: 'spinner' }
  if (state.isPasswordRecovery) return { kind: 'redirect', to: '/reset-password' }
  if (!state.hasSession) return { kind: 'redirect', to: '/login' }
  return { kind: 'allow' }
}

/** Gate for /admin. Checked after the recovery and session gates, never instead of them. */
export function decideRequireSuperAdmin(state: GuardState): GuardOutcome {
  if (state.loading) return { kind: 'spinner' }
  if (state.isPasswordRecovery) return { kind: 'redirect', to: '/reset-password' }
  if (!state.hasSession) return { kind: 'redirect', to: '/login' }
  if (!state.isSuperAdmin) return { kind: 'redirect', to: '/dashboard' }
  return { kind: 'allow' }
}

/** Gate for /login and /signup: an already-authenticated visitor is sent onward. */
export function decideRedirectIfAuthed(state: GuardState): GuardOutcome {
  if (state.loading) return { kind: 'spinner' }
  if (state.isPasswordRecovery) return { kind: 'redirect', to: '/reset-password' }
  if (state.hasSession) return { kind: 'redirect', to: '/dashboard' }
  return { kind: 'allow' }
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, tenantAppUrl } from '@/lib/supabase'
import type { Tenant, TenantSubscription } from '@/types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  tenant: Tenant | null
  subscription: TenantSubscription | null
  /** Browser-facing address of the Web App server this tenant is assigned to, e.g.
   *  https://bill2crm.leadspree.in. Read from the tenant's own app_target rather than derived
   *  from the slug: one server hosts many tenants on a single host, so there is no rule that
   *  turns a slug into an address. Null until the tenant row has loaded. */
  appBaseUrl: string | null
  isSuperAdmin: boolean
  loading: boolean
  /** True from the moment Supabase fires a PASSWORD_RECOVERY auth event (a user landed here via
   *  a password-reset email link) until the password is actually updated or they sign out. Lets
   *  route guards steer a recovery session to /reset-password instead of treating it like any
   *  other "already signed in" session and bouncing straight to the dashboard. */
  isPasswordRecovery: boolean
  refresh: () => Promise<void>
  /** `needsEmailConfirmation` is true when the project requires the user to click a
   *  confirmation link before a session exists — Supabase returns no session in that case, so
   *  the caller must show "check your email" rather than routing to a guarded page. */
  signUp: (
    email: string,
    password: string,
    businessName: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Per-tab marker that this tab is in the middle of a password recovery. sessionStorage, not
 *  localStorage: it must not leak into other tabs or outlive the tab, and it is not a secret —
 *  the recovery session itself is what authorizes the password change. */
const RECOVERY_FLAG_KEY = 'bill2crm_site_password_recovery'

export function readRecoveryFlag(): boolean {
  try {
    return window.sessionStorage.getItem(RECOVERY_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function writeRecoveryFlag(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(RECOVERY_FLAG_KEY, '1')
    else window.sessionStorage.removeItem(RECOVERY_FLAG_KEY)
  } catch {
    /* private mode / storage disabled — the in-memory flag still covers the common path */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null)
  const [appBaseUrl, setAppBaseUrl] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setTenant(null)
      setSubscription(null)
      setAppBaseUrl(null)
      setIsSuperAdmin(false)
      return
    }

    const [tenantResult, adminResult, appUrlResult] = await Promise.all([
      supabase
        .from('tenants')
        .select('*, tenant_subscriptions(*)')
        .eq('owner_user_id', currentUser.id)
        .maybeSingle(),
      supabase.from('super_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle(),
      // Scalar rather than a join on app_targets: that table is super-admin-only under RLS and
      // carries the fleet's tier/capacity topology, which a tenant has no business reading.
      supabase.rpc('tenant_app_base_url'),
    ])

    if (tenantResult.data) {
      const { tenant_subscriptions, ...tenantRow } = tenantResult.data as Tenant & {
        tenant_subscriptions: TenantSubscription | TenantSubscription[] | null
      }
      setTenant(tenantRow)
      setSubscription(Array.isArray(tenant_subscriptions) ? (tenant_subscriptions[0] ?? null) : tenant_subscriptions)
      // No address recorded for this tenant's server yet — fall back to the old
      // <slug>.<ROOT_DOMAIN> derivation so the dashboard still shows something.
      const resolved = typeof appUrlResult.data === 'string' ? appUrlResult.data.replace(/\/+$/, '') : ''
      setAppBaseUrl(resolved || tenantAppUrl(tenantRow.subdomain_slug))
    } else {
      setTenant(null)
      setSubscription(null)
      setAppBaseUrl(null)
    }

    setIsSuperAdmin(Boolean(adminResult.data))
  }, [])

  const refresh = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()
    setSession(currentSession)
    await loadProfile(currentSession?.user ?? null)
  }, [loadProfile])

  useEffect(() => {
    let active = true

    // A recovery session that was already flagged in this tab must survive a reload of
    // /reset-password — the PASSWORD_RECOVERY event fires once, when the link's hash is
    // consumed, and never again. Without this the reloaded page sees an ordinary session and
    // the guards send the user to the dashboard with their password still unchanged.
    if (readRecoveryFlag()) setIsPasswordRecovery(true)

    supabase.auth
      .getSession()
      .then(async ({ data: { session: currentSession } }) => {
        if (!active) return
        setSession(currentSession)
        await loadProfile(currentSession?.user ?? null)
      })
      .catch((err) => {
        // Never leave `loading` true on a failure: every guard renders a full-screen spinner
        // while it is, so a transient network error would strand the whole app there forever.
        console.error('Failed to restore session', err)
        if (!active) return
        setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: subscriptionHandle } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') {
        writeRecoveryFlag(true)
        setIsPasswordRecovery(true)
      }
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        writeRecoveryFlag(false)
        setIsPasswordRecovery(false)
      }
      setSession(currentSession)
      await loadProfile(currentSession?.user ?? null)
    })

    return () => {
      active = false
      subscriptionHandle.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback(async (email: string, password: string, businessName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { businessName }, emailRedirectTo: `${window.location.origin}/login` },
    })
    if (error) return { error: error.message, needsEmailConfirmation: false }
    // With email confirmation enabled on the project (the live control plane has
    // mailer_autoconfirm off) signUp succeeds but returns session: null. Routing to a guarded
    // route here would bounce the user straight back to /login with nothing explaining why.
    return { error: null, needsEmailConfirmation: data.session === null }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    writeRecoveryFlag(false)
    setIsPasswordRecovery(false)
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      tenant,
      subscription,
      appBaseUrl,
      isSuperAdmin,
      loading,
      isPasswordRecovery,
      refresh,
      signUp,
      signIn,
      signOut,
    }),
    [session, tenant, subscription, appBaseUrl, isSuperAdmin, loading, isPasswordRecovery, refresh, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tenant, TenantSubscription } from '@/types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  tenant: Tenant | null
  subscription: TenantSubscription | null
  isSuperAdmin: boolean
  loading: boolean
  /** True from the moment Supabase fires a PASSWORD_RECOVERY auth event (a user landed here via
   *  a password-reset email link) until the password is actually updated or they sign out. Lets
   *  route guards steer a recovery session to /reset-password instead of treating it like any
   *  other "already signed in" session and bouncing straight to the dashboard. */
  isPasswordRecovery: boolean
  refresh: () => Promise<void>
  signUp: (email: string, password: string, businessName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setTenant(null)
      setSubscription(null)
      setIsSuperAdmin(false)
      return
    }

    const [tenantResult, adminResult] = await Promise.all([
      supabase
        .from('tenants')
        .select('*, tenant_subscriptions(*)')
        .eq('owner_user_id', currentUser.id)
        .maybeSingle(),
      supabase.from('super_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle(),
    ])

    if (tenantResult.data) {
      const { tenant_subscriptions, ...tenantRow } = tenantResult.data as Tenant & {
        tenant_subscriptions: TenantSubscription | TenantSubscription[] | null
      }
      setTenant(tenantRow)
      setSubscription(Array.isArray(tenant_subscriptions) ? (tenant_subscriptions[0] ?? null) : tenant_subscriptions)
    } else {
      setTenant(null)
      setSubscription(null)
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

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!active) return
      setSession(currentSession)
      await loadProfile(currentSession?.user ?? null)
      if (active) setLoading(false)
    })

    const { data: subscriptionHandle } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setIsPasswordRecovery(false)
      setSession(currentSession)
      await loadProfile(currentSession?.user ?? null)
    })

    return () => {
      active = false
      subscriptionHandle.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = useCallback(async (email: string, password: string, businessName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { businessName } },
    })
    return { error: error?.message ?? null }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      tenant,
      subscription,
      isSuperAdmin,
      loading,
      isPasswordRecovery,
      refresh,
      signUp,
      signIn,
      signOut,
    }),
    [session, tenant, subscription, isSuperAdmin, loading, isPasswordRecovery, refresh, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

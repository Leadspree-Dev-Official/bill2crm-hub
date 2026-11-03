import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { requestAppLaunchUrl } from '@/lib/api/launch-app'
import type { SubscriptionPlan } from '@/types/database'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { daysRemaining, formatInr, formatLimit, getSubscriptionPeriodInfo, resolveTenantDisplayStatus } from '@/lib/plan-utils'
import { ArrowUpRight, AlertTriangle, Calendar, Check, Clock, Copy, CreditCard, Loader2, MessageSquare, Receipt, Rocket, Sparkles, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import { buildWhatsAppSupportLink } from '@/lib/whatsapp'
import { acknowledgeBillingNotification, type BillingNotification, type BillingPayment } from '@/lib/api/billing'
import { cn } from '@/lib/utils'

const BILLING_CYCLE_LABEL: Record<string, string> = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' }

export default function DashboardPage() {
  const { tenant, subscription, appBaseUrl, loading, refresh } = useAuth()
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [launching, setLaunching] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLaunch, setCopiedLaunch] = useState(false)
  const [copyingLaunch, setCopyingLaunch] = useState(false)
  // Captured once per mount rather than read during render: calling Date.now()
  // in the render body is impure and can yield a different trial percentage on
  // each pass under React 19's concurrent rendering.
  const [renderedAt] = useState(() => Date.now())

  // Revalidate profile, subscription, and instance URL on mount so navigation to dashboard
  // is always completely up-to-date without needing a browser reload.
  useEffect(() => {
    void refresh()
  }, [refresh])

  const [billingNotifications, setBillingNotifications] = useState<BillingNotification[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [billingSub, setBillingSub] = useState<{
    current_period_start?: string | null
    current_period_end?: string | null
    charge_at?: string | null
  } | null>(null)

  useEffect(() => {
    if (!subscription?.plan_id) return
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', subscription.plan_id)
      .maybeSingle()
      .then(({ data }) => setPlan(data as SubscriptionPlan | null))
  }, [subscription?.plan_id])

  useEffect(() => {
    if (!tenant?.id) return
    supabase
      .from('billing_notifications')
      .select('*')
      .eq('tenant_id', tenant.id)
      .is('acknowledged_at', null)
      .order('due_at', { ascending: false })
      .then(({ data }) => setBillingNotifications((data as BillingNotification[]) ?? []))

    supabase
      .from('billing_payments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setPayments((data as BillingPayment[]) ?? []))

    supabase
      .from('billing_subscriptions')
      .select('current_period_start, current_period_end, charge_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setBillingSub(data ?? null))
  }, [tenant?.id])

  async function handleDismissNotification(id: string) {
    await acknowledgeBillingNotification(id)
    setBillingNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  async function handleLaunch() {
    // The tab is opened SYNCHRONOUSLY, before the await: a window.open() that runs after an
    // async hop has lost the user-gesture context and browsers block it as a popup. So we
    // claim the tab on click and point it at the link once minted. If it is blocked anyway
    // (null handle), fall back to navigating this tab rather than dead-ending.
    //
    // No 'noopener' in the feature string — with it the browser returns null by design and
    // there would be no handle left to navigate. The reverse-tabnabbing protection it would
    // have given is applied below instead, by severing opener before the URL is set.
    const tab = window.open('about:blank', '_blank')
    if (tab) {
      try {
        tab.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Opening Bill2CRM...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .card {
      text-align: center;
      padding: 36px 32px;
      max-width: 420px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
    }
    .spinner-wrap {
      position: relative;
      width: 44px;
      height: 44px;
      margin: 0 auto 18px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255,255,255,0.12);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 18px; font-weight: 600; margin: 0 0 8px; color: #fff; }
    p { font-size: 13px; color: #a1a1aa; margin: 0 0 16px; line-height: 1.5; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      font-size: 11px;
      color: #60a5fa;
      font-family: ui-monospace, monospace;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #3b82f6;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner-wrap">
      <div class="spinner"></div>
    </div>
    <h2>Connecting to Workspace</h2>
    <p>Minting secure single sign-on link and preparing your application session&hellip;</p>
    <div class="status-badge">
      <span class="dot"></span>
      <span>Authenticating session</span>
    </div>
  </div>
</body>
</html>`)
        tab.document.close()
      } catch {
        /* blocked or cross-origin */
      }
    }

    const toastId = toast.loading('Connecting to your workspace…', {
      description: 'Opening new tab and establishing secure session…',
    })

    setLaunching(true)
    const { url, error } = await requestAppLaunchUrl()
    setLaunching(false)

    if (error || !url) {
      tab?.close()
      toast.error("Couldn't open your app", {
        id: toastId,
        description: error ?? 'Please try again in a moment.',
      })
      return
    }

    toast.success('Workspace ready!', {
      id: toastId,
      description: 'Opening your application…',
      duration: 3000,
    })

    if (tab) {
      // Sever the back-reference before handing the tab a real origin, so the Web App can
      // never reach back into this dashboard through window.opener.
      try {
        tab.opener = null
      } catch {
        /* cross-origin already, or blocked — the tab is about:blank, nothing to protect yet */
      }
      tab.location.href = url
    } else {
      window.location.href = url
    }
  }

  async function handleCopyLink() {
    if (!appBaseUrl) return
    await navigator.clipboard.writeText(appBaseUrl)
    setCopied(true)
    toast.success('Instance link copied')
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleCopyLaunchLink() {
    setCopyingLaunch(true)
    const { url, error } = await requestAppLaunchUrl()
    setCopyingLaunch(false)

    if (error || !url) {
      if (appBaseUrl) {
        await navigator.clipboard.writeText(appBaseUrl)
        setCopiedLaunch(true)
        toast.success('Instance link copied', {
          description: 'Workspace address copied to clipboard.',
        })
        setTimeout(() => setCopiedLaunch(false), 2000)
      } else {
        toast.error("Couldn't generate sign-in link", { description: error ?? 'Please try again in a moment.' })
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiedLaunch(true)
      toast.success('Sign-in link copied', {
        description: 'One-time direct sign-in link copied to clipboard.',
      })
      setTimeout(() => setCopiedLaunch(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <p>We&apos;re still setting up your workspace. Refresh in a moment.</p>
      </div>
    )
  }

  const isTrial = subscription?.status === 'trial'
  const trialDays = isTrial ? daysRemaining(subscription.trial_ends_at) : null
  const trialPct = (() => {
    if (!isTrial || !subscription?.trial_ends_at || !subscription?.created_at) return 0
    const start = new Date(subscription.created_at).getTime()
    const end = new Date(subscription.trial_ends_at).getTime()
    const elapsed = renderedAt - start
    const total = end - start
    if (total <= 0) return 100
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })()

  const priceLabel = subscription?.is_lifetime
    ? formatInr(plan?.price_lifetime_inr)
    : subscription?.billing_cycle === 'yearly'
      ? formatInr(plan?.price_yearly_inr)
      : formatInr(plan?.price_monthly_inr)
  const priceSuffix = subscription?.is_lifetime ? 'one-time' : subscription?.billing_cycle === 'yearly' ? '/year' : '/month'
  const instanceUrl = appBaseUrl

  const isPaused = tenant.status === 'paused'
  const isSuspended = tenant.status === 'suspended'
  const isInactiveBlocked = isPaused || isSuspended
  const periodInfo = getSubscriptionPeriodInfo(
    {
      ...subscription,
      current_period_start: billingSub?.current_period_start || payments[0]?.period_start || subscription?.created_at,
      charge_at: billingSub?.charge_at,
    },
    renderedAt,
  )
  const displayStatus = resolveTenantDisplayStatus(tenant.status, subscription, renderedAt)

  const isPastDue = displayStatus === 'past_due' || tenant.status === 'past_due'

  const isPaid =
    Boolean(subscription?.is_lifetime) ||
    Boolean(subscription?.billing_cycle === 'lifetime') ||
    (Boolean(subscription?.plan_id && subscription.plan_id !== 'plan_free' && subscription.plan_id !== 'plan_trial') &&
      !periodInfo.isExpired &&
      displayStatus === 'active')

  const isTrialExpired =
    !isPaid &&
    !isPastDue &&
    (displayStatus === 'free' ||
      subscription?.status === 'free' ||
      tenant.status === 'free' ||
      (isTrial && (trialDays === 0 || (subscription?.trial_ends_at && new Date(subscription.trial_ends_at).getTime() <= renderedAt))))

  const waSupportLink = buildWhatsAppSupportLink({
    businessName: tenant.business_name,
    subdomainSlug: tenant.subdomain_slug,
    reason: isPaused ? 'paused due to 15+ days of inactivity' : 'suspended due to 30+ days of inactivity',
  })

  return (
    <AppShell>
      {isPastDue && (
        <div className="mb-6 overflow-hidden rounded-lg border border-destructive/40 bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent p-5 text-destructive dark:text-red-300 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-full bg-destructive/20 p-2 text-destructive shrink-0 mt-0.5">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">Subscription Expired · Payment Past Due</h3>
                  <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive text-[10px] uppercase font-mono">
                    Grace Period Active
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-destructive/90 dark:text-red-300/90 max-w-2xl">
                  {periodInfo.statusText}. Please renew your plan now to prevent workspace interruption and retain full functionality.
                </p>
              </div>
            </div>
            <div className="shrink-0 sm:self-center">
              <Button asChild size="sm" className="w-full sm:w-auto gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm font-medium">
                <Link to="/dashboard/upgrade">
                  <CreditCard className="size-3.5" />
                  Renew Subscription Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {isTrialExpired && (
        <div className="mb-6 overflow-hidden rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 text-amber-950 dark:text-amber-100 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-full bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Sparkles className="size-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">Your 7-Day Free Trial Has Expired</h3>
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] uppercase font-mono">
                    Free Tier Active
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80 max-w-2xl">
                  Your workspace is currently operating under Free tier restrictions (1 user, 10 invoices/month limit, manual reminders only). Upgrade to unlock unlimited invoices, automated WhatsApp payment reminders, multi-user access, and priority cloud infrastructure.
                </p>
              </div>
            </div>
            <div className="shrink-0 sm:self-center">
              <Button asChild size="sm" className="w-full sm:w-auto gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-sm font-medium">
                <Link to="/dashboard/upgrade">
                  <Zap className="size-3.5" />
                  Upgrade Workspace Now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {billingNotifications.map((notif) => (
        <div
          key={notif.id}
          className={cn(
            'mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 text-sm',
            notif.severity === 'critical'
              ? 'border-destructive/50 bg-destructive/10 text-destructive'
              : notif.severity === 'warning'
                ? 'border-amber-400/50 bg-amber-50/80 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-sky-400/50 bg-sky-50/80 text-sky-900 dark:bg-sky-950/30 dark:text-sky-200',
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold">{notif.title}</h3>
              <p className="mt-0.5 text-xs opacity-90">{notif.body}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-8 gap-1.5 bg-primary text-primary-foreground">
              <Link to="/dashboard/upgrade">
                <CreditCard className="size-3.5" />
                Pay / Renew Plan
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => handleDismissNotification(notif.id)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}

      {isPaused && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-400/50 bg-amber-50/80 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-sm font-semibold">Workspace Paused (15+ Days Inactivity)</h3>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                Neither you nor your invited members have logged in for over 15 days. All logins have been paused until you contact an administrator. If inactivity reaches 30 days, your workspace will be automatically suspended.
              </p>
            </div>
          </div>
          {waSupportLink && (
            <Button
              asChild
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <a href={waSupportLink} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="mr-1.5 size-3.5" />
                Contact Admin to Reactivate
              </a>
            </Button>
          )}
        </div>
      )}

      {isSuspended && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold">Workspace Suspended (30+ Days Inactivity)</h3>
              <p className="mt-0.5 text-xs text-destructive/90">
                Your workspace was automatically suspended after 30 days of inactivity. Only an administrator can resume your workspace. If non-usage reaches 60 days, all account data will be permanently deleted.
              </p>
            </div>
          </div>
          {waSupportLink && (
            <Button
              asChild
              size="sm"
              variant="destructive"
            >
              <a href={waSupportLink} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="mr-1.5 size-3.5" />
                Contact Admin to Resume
              </a>
            </Button>
          )}
        </div>
      )}

      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold">{tenant.business_name}</h1>
              <StatusBadge status={resolveTenantDisplayStatus(tenant.status, subscription)} />
            </div>
            {/* Null means this tenant's server has no app_base_url recorded. Rather than show a
                derived <slug>.<ROOT_DOMAIN> address that does not resolve, show nothing at all —
                "Launch my app" still works, since it resolves the target server-side. */}
            {instanceUrl ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded-sm border border-border bg-surface-muted px-2.5 py-1.5 font-mono text-[12px] text-muted-foreground">
                  {instanceUrl}
                </code>
                <Button variant="ghost" size="sm" onClick={handleCopyLink} className="h-8">
                  {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="lg"
              onClick={handleLaunch}
              disabled={launching || copyingLaunch || isInactiveBlocked}
              title={isInactiveBlocked ? 'Workspace is paused/suspended due to inactivity' : undefined}
              className="shrink-0 gap-2"
            >
              {launching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isPaused ? (
                <AlertTriangle className="size-4 text-amber-500" />
              ) : isSuspended ? (
                <AlertTriangle className="size-4" />
              ) : (
                <Rocket className="size-4" />
              )}
              {launching
                ? 'Opening workspace…'
                : isPaused
                  ? 'Workspace Paused'
                  : isSuspended
                    ? 'Workspace Suspended'
                    : 'Launch my app'}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-lg"
                  onClick={handleCopyLaunchLink}
                  disabled={launching || copyingLaunch}
                  aria-label="Copy sign-in link"
                  title="Copy sign-in link"
                >
                  {copyingLaunch ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : copiedLaunch ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{copiedLaunch ? 'Copied!' : 'Copy sign-in link'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {launching && (
          <div className="mt-4 flex items-center gap-2.5 rounded-md border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs text-primary animate-in fade-in slide-in-from-top-1 w-full">
            <Loader2 className="size-4 animate-spin shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">Launching workspace in new tab&hellip;</p>
              <p className="text-muted-foreground text-[11px]">Minting single sign-on link and authenticating session securely.</p>
            </div>
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Subscription</p>
              <h2 className="mt-2 text-xl font-semibold">{plan?.name ?? 'Loading plan…'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan?.description}</p>
            </div>
            <div className="text-right">
              <p className="tabular font-display text-2xl font-semibold">{isTrial ? 'Free' : (priceLabel ?? '—')}</p>
              {!isTrial && priceLabel ? (
                <p className="text-xs text-muted-foreground">{priceSuffix}</p>
              ) : (
                <p className="text-xs capitalize text-muted-foreground">
                  {subscription?.billing_cycle && BILLING_CYCLE_LABEL[subscription.billing_cycle]}
                </p>
              )}
            </div>
          </div>

          {/* Key Subscription Dates: Start Date, End Date, Due Date for Renew */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-border bg-surface-muted/60 p-3.5">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Calendar className="size-3.5 text-sky-500" />
                <span>Subscription Start Date</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {periodInfo.formattedStartDate ?? '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isTrial ? 'Trial activated' : 'Subscription start'}
              </p>
            </div>

            <div className="space-y-1 sm:border-l sm:border-border sm:pl-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Clock className="size-3.5 text-indigo-500" />
                <span>Subscription End Date</span>
              </div>
              <p
                className={`text-sm font-semibold ${
                  periodInfo.isExpired
                    ? 'text-destructive dark:text-red-400'
                    : periodInfo.isExpiringSoon
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground'
                }`}
              >
                {subscription?.is_lifetime ? 'Lifetime' : periodInfo.formattedEndDate ?? 'No expiry'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {subscription?.is_lifetime
                  ? 'No expiration'
                  : periodInfo.diffDays !== null
                    ? periodInfo.diffDays < 0
                      ? `Expired ${Math.abs(periodInfo.diffDays)}d ago`
                      : periodInfo.diffDays === 0
                        ? 'Expires today'
                        : `${periodInfo.diffDays} days remaining`
                    : 'Active plan'}
              </p>
            </div>

            <div className="space-y-1 sm:border-l sm:border-border sm:pl-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <CreditCard className="size-3.5 text-emerald-500" />
                <span>Due Date for Renew</span>
              </div>
              <p
                className={`text-sm font-semibold ${
                  periodInfo.isExpired
                    ? 'text-destructive dark:text-red-400'
                    : periodInfo.isExpiringSoon
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground'
                }`}
              >
                {subscription?.is_lifetime ? 'None' : periodInfo.formattedDueDate ?? 'Upon renewal'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {subscription?.is_lifetime
                  ? 'Lifetime access'
                  : periodInfo.isExpired
                    ? `Grace ends: ${periodInfo.formattedGraceDueDate ?? '—'}`
                    : 'Renewal deadline'}
              </p>
            </div>
          </div>

          {isTrial && subscription?.trial_ends_at && trialDays !== 0 ? (
            <div className="mt-6 rounded-md border border-border bg-surface-muted p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Free trial</p>
                <p className="tabular text-sm text-muted-foreground">
                  {trialDays} day{trialDays === 1 ? '' : 's'} left
                </p>
              </div>
              <Progress value={trialPct} className="mt-3 h-2" />
              <p className="mt-2.5 font-mono text-[11px] text-muted-foreground">
                Ends{' '}
                {new Date(subscription.trial_ends_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          ) : isTrialExpired ? (
            <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Trial expired · Operating on Free plan with usage limits</span>
              </div>
              <p className="mt-1.5 text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                Upgrade to a paid monthly, yearly, or lifetime plan to remove counter and invoice limits and enable automated reminders.
              </p>
            </div>
          ) : isPastDue ? (
            <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive dark:text-red-300">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 text-destructive shrink-0" />
                <span>Subscription Expired · {periodInfo.statusText}</span>
              </div>
              <p className="mt-1.5 text-[11px] opacity-90 leading-relaxed">
                Your workspace is currently within the grace period. Renew your subscription now to maintain uninterrupted workspace access.
              </p>
            </div>
          ) : periodInfo.isExpiringSoon ? (
            <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Renewal Approaching · {periodInfo.statusText}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                Your subscription period ends soon. Renew ahead of time to ensure continuous team access.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-md border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
              {subscription?.is_lifetime
                ? 'Lifetime access — no renewal required.'
                : periodInfo.formattedDate
                  ? `Renews on ${periodInfo.formattedDate} (in ${periodInfo.diffDays ?? 0} days)`
                  : 'Plan is active.'}
            </div>
          )}

          <Button asChild className="mt-5 w-full gap-1.5" variant={isTrial || isTrialExpired || isPastDue ? 'default' : 'outline'}>
            <Link to="/dashboard/upgrade">
              {isPastDue ? 'Renew Subscription Now' : isTrialExpired ? 'Upgrade Workspace' : isTrial ? 'Upgrade before the trial ends' : 'Change plan'}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-surface p-6">
          <p className="eyebrow">Usage against plan limits</p>

          <div className="mt-5 space-y-5">
            <UsageStat
              icon={Users}
              label="Users"
              value={formatLimit(subscription?.user_limit_override ?? plan?.user_limit ?? null)}
            />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Limits are enforced on your instance. Crossing a limit does not stop billing — we contact you on
            WhatsApp before anything changes.
          </p>
        </section>
      </div>

      {payments.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Payment History & Tax Invoices</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Invoice #</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Plan & Cycle</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {payments.map((p) => (
                  <tr key={p.id} className="text-xs">
                    <td className="py-2.5 font-mono font-medium text-foreground">{p.invoice_no || '—'}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {new Date(p.captured_at || p.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 capitalize">{p.plan_id ? p.plan_id.replace('plan_', '') : '—'} ({p.billing_cycle || '—'})</td>
                    <td className="py-2.5 font-medium">
                      ₹{Math.round((p.amount_paise + (p.tax_paise || 0)) / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 capitalize text-muted-foreground">{p.method.replace('_', ' ')}</td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 capitalize">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  )
}

function UsageStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 text-primary" />
        <p className="text-sm font-medium">{label}</p>
        <p className="tabular ml-auto font-mono text-[13px] text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { requestAppLaunchUrl } from '@/lib/api/launch-app'
import type { SubscriptionPlan } from '@/types/database'
import { AppShell } from '@/components/app-shell'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { daysRemaining, formatInr, formatLimit } from '@/lib/plan-utils'
import { ArrowUpRight, Check, Copy, Loader2, Rocket, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'

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

  useEffect(() => {
    if (!subscription?.plan_id) return
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', subscription.plan_id)
      .maybeSingle()
      .then(({ data }) => setPlan(data as SubscriptionPlan | null))
  }, [subscription?.plan_id])

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

  return (
    <AppShell>
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold">{tenant.business_name}</h1>
              <StatusBadge status={tenant.status} />
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
            <Button size="lg" onClick={handleLaunch} disabled={launching || copyingLaunch} className="shrink-0 gap-2">
              {launching ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {launching ? 'Opening workspace…' : 'Launch my app'}
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

          {isTrial && subscription?.trial_ends_at ? (
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
          ) : (
            <div className="mt-6 rounded-md border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
              {subscription?.is_lifetime
                ? 'Lifetime access — no renewal.'
                : subscription?.current_period_end
                  ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Plan is active.'}
            </div>
          )}

          <Button asChild className="mt-5 w-full" variant={isTrial ? 'default' : 'outline'}>
            <Link to="/dashboard/upgrade">
              {isTrial ? 'Upgrade before the trial ends' : 'Change plan'}
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

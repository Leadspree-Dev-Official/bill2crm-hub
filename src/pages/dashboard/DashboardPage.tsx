import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase, tenantAppUrl } from '@/lib/supabase'
import { requestAppLaunchUrl } from '@/lib/api/launch-app'
import type { SubscriptionPlan } from '@/types/database'
import { AppNav } from '@/components/app-nav'
import { UpgradeRequestDialog } from '@/components/upgrade-request-dialog'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { daysRemaining, formatInr, formatLimit, STATUS_BADGE_VARIANT, STATUS_LABEL } from '@/lib/plan-utils'
import { Check, Copy, ExternalLink, HardDrive, Loader2, Rocket, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'

const BILLING_CYCLE_LABEL: Record<string, string> = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' }

export default function DashboardPage() {
  const { tenant, subscription, loading } = useAuth()
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [launching, setLaunching] = useState(false)
  const [copied, setCopied] = useState(false)

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
    setLaunching(true)
    const { url, error } = await requestAppLaunchUrl()
    setLaunching(false)

    if (error || !url) {
      toast.error("Couldn't open your app", { description: error ?? 'Please try again in a moment.' })
      return
    }
    window.location.href = url
  }

  async function handleCopyLink() {
    if (!tenant) return
    await navigator.clipboard.writeText(tenantAppUrl(tenant.subdomain_slug))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
      <div className="flex min-h-screen flex-col">
        <AppNav title="Bill2CRM" />
        <div className="mx-auto mt-16 max-w-md text-center text-muted-foreground">
          <p>We&apos;re still setting up your workspace. Refresh in a moment.</p>
        </div>
      </div>
    )
  }

  const isTrial = subscription?.status === 'trial'
  const trialDays = isTrial ? daysRemaining(subscription.trial_ends_at) : null
  const trialPct = (() => {
    if (!isTrial || !subscription?.trial_ends_at || !subscription?.created_at) return 0
    const start = new Date(subscription.created_at).getTime()
    const end = new Date(subscription.trial_ends_at).getTime()
    const elapsed = Date.now() - start
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

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <AppNav title="Bill2CRM" />
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
              {tenant.business_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{tenant.business_name}</h1>
              <button
                onClick={handleCopyLink}
                className="group flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {tenant.subdomain_slug}.bill2crm.in
                {copied ? (
                  <Check className="size-3.5 text-primary" />
                ) : (
                  <Copy className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </button>
            </div>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[tenant.status]} className="text-sm">
            {STATUS_LABEL[tenant.status]}
          </Badge>
        </div>

        <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.07] via-primary/[0.02] to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="size-5 text-primary" /> Your workspace is ready
            </CardTitle>
            <CardDescription>Open your Bill2CRM app — no separate login needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={handleLaunch} disabled={launching}>
              {launching ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Launch my app
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-6">
            <CardTitle className="flex items-center gap-2 text-base">
              {plan?.name ?? 'Loading plan…'}
              {subscription?.billing_cycle && !isTrial && (
                <Badge variant="secondary" className="font-normal">
                  {BILLING_CYCLE_LABEL[subscription.billing_cycle] ?? subscription.billing_cycle}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{isTrial ? 'Free trial' : 'Current plan'}</CardDescription>
            <CardAction>
              <div className="text-right tabular-nums">
                <div className="text-2xl font-bold">{isTrial ? 'Free' : (priceLabel ?? '—')}</div>
                {!isTrial && priceLabel && <div className="text-xs text-muted-foreground">{priceSuffix}</div>}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {isTrial && subscription?.trial_ends_at && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Trial progress</span>
                  <span className="text-muted-foreground">
                    {trialDays} day{trialDays === 1 ? '' : 's'} left
                  </span>
                </div>
                <Progress value={trialPct} className="h-1.5" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Ends{' '}
                  {new Date(subscription.trial_ends_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}

            {!isTrial && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {subscription?.is_lifetime ? 'Access' : 'Renews'}
                </span>
                <span className="font-medium">
                  {subscription?.is_lifetime
                    ? 'Lifetime'
                    : subscription?.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <UsageStat
                icon={Users}
                label="Users"
                value={formatLimit(subscription?.user_limit_override ?? plan?.user_limit ?? null)}
              />
              <UsageStat
                icon={HardDrive}
                label="Storage"
                value={formatLimit(subscription?.storage_limit_override_mb ?? plan?.storage_limit_mb ?? null, ' MB')}
              />
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-6">
            <p className="text-sm text-muted-foreground">Need more room to grow?</p>
            <UpgradeRequestDialog
              tenantId={tenant.id}
              businessName={tenant.business_name}
              subdomainSlug={tenant.subdomain_slug}
            />
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}

function UsageStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  )
}

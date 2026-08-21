import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { requestAppLaunchUrl } from '@/lib/api/launch-app'
import type { SubscriptionPlan } from '@/types/database'
import { AppNav } from '@/components/app-nav'
import { UpgradeRequestDialog } from '@/components/upgrade-request-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { daysRemaining, formatInr, formatLimit, STATUS_BADGE_VARIANT, STATUS_LABEL } from '@/lib/plan-utils'
import { ExternalLink, Loader2, Rocket } from 'lucide-react'
import { toast } from 'sonner'

export default function DashboardPage() {
  const { tenant, subscription, loading } = useAuth()
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [launching, setLaunching] = useState(false)

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

  const trialDays = subscription?.status === 'trial' ? daysRemaining(subscription.trial_ends_at) : null

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <AppNav title="Bill2CRM" />
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.business_name}</h1>
          <p className="text-muted-foreground">{tenant.subdomain_slug}.bill2crm.in</p>
        </div>

        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Rocket className="size-5 text-primary" /> Your workspace is ready
              </CardTitle>
              <Badge variant={STATUS_BADGE_VARIANT[tenant.status]}>{STATUS_LABEL[tenant.status]}</Badge>
            </div>
            <CardDescription>
              {trialDays !== null
                ? `${trialDays} day${trialDays === 1 ? '' : 's'} left in your free trial.`
                : 'Open your Bill2CRM app — no separate login needed.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={handleLaunch} disabled={launching}>
              {launching ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
              Launch my app
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan &amp; usage</CardTitle>
            <CardDescription>{plan?.name ?? 'Loading plan details…'}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Users" value={formatLimit(subscription?.user_limit_override ?? plan?.user_limit ?? null)} />
            <Stat
              label="Storage"
              value={formatLimit(subscription?.storage_limit_override_mb ?? plan?.storage_limit_mb ?? null, ' MB')}
            />
            <Stat label="Monthly price" value={formatInr(plan?.price_monthly_inr) ?? '—'} />
            <Stat
              label="Renews"
              value={
                subscription?.is_lifetime
                  ? 'Lifetime'
                  : subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString('en-IN')
                    : '—'
              }
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <UpgradeRequestDialog tenantId={tenant.id} />
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

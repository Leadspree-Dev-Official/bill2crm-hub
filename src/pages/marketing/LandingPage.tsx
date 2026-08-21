import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { SubscriptionPlan } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatInr } from '@/lib/plan-utils'
import { Check, FileText, Receipt, Shield, Users } from 'lucide-react'

const FEATURES = [
  { icon: Receipt, title: 'GST invoicing', desc: 'Compliant invoices, quotes & recurring bills, ready in seconds.' },
  { icon: Users, title: 'Built-in mini CRM', desc: 'Track leads, follow-ups and customer history alongside every invoice.' },
  { icon: FileText, title: 'Secured Doc Vault', desc: 'Share business documents with customers through signed, expiring links.' },
  { icon: Shield, title: 'Private cloud option', desc: 'Move up to your own Supabase database whenever you outgrow shared.' },
]

export default function LandingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setPlans((data as SubscriptionPlan[]) ?? []))
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm text-primary-foreground">
              B2
            </span>
            Bill2CRM
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Start free trial</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
          GST invoicing + mini CRM
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Invoicing and CRM, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">built for Indian businesses</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          GST-compliant invoices, quotes, recurring bills and a built-in mini CRM — start free, get a 7-day trial
          of everything, and get your own Bill2CRM workspace instantly.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/signup">Start your 7-day free trial</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#pricing">See pricing</a>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="size-6 text-primary" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{f.desc}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Plans that grow with you</h2>
          <p className="mt-2 text-muted-foreground">Every plan includes GST invoicing and the built-in mini CRM.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={plan.id === 'plan_private_cloud' ? 'border-primary shadow-lg' : undefined}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {plan.price_lifetime_inr != null
                    ? `${formatInr(plan.price_lifetime_inr)}`
                    : plan.price_monthly_inr != null
                      ? `${formatInr(plan.price_monthly_inr)}`
                      : 'Custom'}
                  <span className="text-sm font-normal text-muted-foreground">
                    {plan.price_lifetime_inr != null ? ' one-time' : plan.price_monthly_inr != null ? '/mo' : ''}
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-accent" />
                    {plan.user_limit ? `${plan.user_limit} user${plan.user_limit > 1 ? 's' : ''}` : 'Unlimited users'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-accent" />
                    {plan.storage_limit_mb ? `${plan.storage_limit_mb} MB storage` : 'Unlimited storage'}
                  </li>
                </ul>
                <Button className="w-full" variant={plan.id === 'plan_private_cloud' ? 'default' : 'outline'} asChild>
                  <Link to="/signup">Start free trial</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Powered &amp; developed by Leadspree Business Solutions
      </footer>
    </div>
  )
}

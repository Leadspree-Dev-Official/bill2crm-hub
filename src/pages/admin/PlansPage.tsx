import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { upsertSubscriptionPlan } from '@/lib/api/admin'
import type { SubscriptionPlan } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatInr } from '@/lib/plan-utils'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

const emptyPlan = {
  id: '',
  name: '',
  description: '',
  price_monthly_inr: '',
  price_yearly_inr: '',
  price_lifetime_inr: '',
  user_limit: '',
  storage_limit_mb: '',
  is_active: true,
  sort_order: '0',
  web_app_plan_id: '',
}

type PlanFormState = typeof emptyPlan

export default function PlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PlanFormState>(emptyPlan)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('subscription_plans').select('*').order('sort_order')
    if (error) toast.error('Could not load plans', { description: error.message })
    setPlans((data as SubscriptionPlan[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openForEdit(plan?: SubscriptionPlan) {
    setForm(
      plan
        ? {
            id: plan.id,
            name: plan.name,
            description: plan.description ?? '',
            price_monthly_inr: plan.price_monthly_inr?.toString() ?? '',
            price_yearly_inr: plan.price_yearly_inr?.toString() ?? '',
            price_lifetime_inr: plan.price_lifetime_inr?.toString() ?? '',
            user_limit: plan.user_limit?.toString() ?? '',
            storage_limit_mb: plan.storage_limit_mb?.toString() ?? '',
            is_active: plan.is_active,
            sort_order: plan.sort_order.toString(),
            web_app_plan_id: plan.web_app_plan_id ?? '',
          }
        : emptyPlan,
    )
    setOpen(true)
  }

  async function save() {
    if (!form.id || !form.name) {
      toast.error('Plan ID and name are required')
      return
    }
    setSaving(true)
    const { error } = await upsertSubscriptionPlan({
      id: form.id,
      name: form.name,
      description: form.description || null,
      priceMonthlyInr: form.price_monthly_inr ? Number(form.price_monthly_inr) : null,
      priceYearlyInr: form.price_yearly_inr ? Number(form.price_yearly_inr) : null,
      priceLifetimeInr: form.price_lifetime_inr ? Number(form.price_lifetime_inr) : null,
      userLimit: form.user_limit ? Number(form.user_limit) : null,
      storageLimitMb: form.storage_limit_mb ? Number(form.storage_limit_mb) : null,
      featureFlags: {},
      isActive: form.is_active,
      sortOrder: Number(form.sort_order) || 0,
      webAppPlanId: form.web_app_plan_id || null,
    })
    setSaving(false)

    if (error) {
      toast.error('Could not save plan', { description: error })
      return
    }
    toast.success('Plan saved')
    setOpen(false)
    void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Plans</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openForEdit()}>
              <Plus className="size-4" /> New plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{plans.some((p) => p.id === form.id) ? 'Edit plan' : 'New plan'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan ID</Label>
                <Input
                  placeholder="plan_starter"
                  value={form.id}
                  disabled={plans.some((p) => p.id === form.id)}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Monthly price (₹)</Label>
                <Input
                  type="number"
                  value={form.price_monthly_inr}
                  onChange={(e) => setForm({ ...form, price_monthly_inr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly price (₹)</Label>
                <Input
                  type="number"
                  value={form.price_yearly_inr}
                  onChange={(e) => setForm({ ...form, price_yearly_inr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lifetime price (₹)</Label>
                <Input
                  type="number"
                  value={form.price_lifetime_inr}
                  onChange={(e) => setForm({ ...form, price_lifetime_inr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>User limit (blank = unlimited)</Label>
                <Input value={form.user_limit} onChange={(e) => setForm({ ...form, user_limit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Storage MB (blank = unlimited)</Label>
                <Input
                  value={form.storage_limit_mb}
                  onChange={(e) => setForm({ ...form, storage_limit_mb: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Web App plan ID</Label>
                <Input
                  placeholder="matching plan id in the Bill2CRM Web App project"
                  value={form.web_app_plan_id}
                  onChange={(e) => setForm({ ...form, web_app_plan_id: e.target.value })}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="active">Visible on pricing page</Label>
                <Switch
                  id="active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.name}
                  {!plan.is_active && <span className="text-xs font-normal text-muted-foreground">hidden</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{plan.description}</p>
                <p>{formatInr(plan.price_monthly_inr) ?? '—'}/mo</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => openForEdit(plan)}>
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { formatInr } from '@/lib/plan-utils'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

const FEATURE_SWITCHES = [
  { key: 'vaultAccess', label: 'Legal document vault' },
  { key: 'aiAgentsAccess', label: 'AI agents' },
  { key: 'allowReceiptAttachments', label: 'Receipt attachments' },
  { key: 'cloudSchedulingAccess', label: 'Cloud scheduling' },
] as const

const emptyPlan = {
  id: '',
  name: '',
  description: '',
  price_monthly_inr: '',
  price_yearly_inr: '',
  price_lifetime_inr: '',
  user_limit: '',
  storage_limit_mb: '',
  periodic_limit: '',
  vault_file_limit: '',
  is_active: true,
  sort_order: '0',
  web_app_plan_id: '',
  vaultAccess: true,
  aiAgentsAccess: true,
  allowReceiptAttachments: true,
  cloudSchedulingAccess: false,
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
    const flags = plan?.feature_flags ?? {}
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
            periodic_limit: plan.periodic_limit?.toString() ?? '',
            vault_file_limit: typeof flags.vaultFileLimit === 'number' ? flags.vaultFileLimit.toString() : '',
            is_active: plan.is_active,
            sort_order: plan.sort_order.toString(),
            web_app_plan_id: plan.web_app_plan_id ?? '',
            vaultAccess: flags.vaultAccess !== false,
            aiAgentsAccess: flags.aiAgentsAccess !== false,
            allowReceiptAttachments: flags.allowReceiptAttachments !== false,
            cloudSchedulingAccess: flags.cloudSchedulingAccess === true,
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
      periodicLimit: form.periodic_limit ? Number(form.periodic_limit) : null,
      featureFlags: {
        vaultAccess: form.vaultAccess,
        vaultFileLimit: form.vault_file_limit ? Number(form.vault_file_limit) : null,
        aiAgentsAccess: form.aiAgentsAccess,
        allowReceiptAttachments: form.allowReceiptAttachments,
        cloudSchedulingAccess: form.cloudSchedulingAccess,
      },
      isActive: form.is_active,
      sortOrder: Number(form.sort_order) || 0,
      webAppPlanId: form.web_app_plan_id || null,
    })
    setSaving(false)

    if (error?.startsWith('Plan saved, but')) {
      toast.warning('Plan saved locally', { description: error })
      setOpen(false)
      void load()
      return
    }
    if (error) {
      toast.error('Could not save plan', { description: error })
      return
    }
    toast.success('Plan saved')
    setOpen(false)
    void load()
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Plans"
        description="Pricing, limits and visibility for every subscription plan shown on the pricing page."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openForEdit()}>
                <Plus className="size-4" /> New plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="text-xl font-display">
                  {plans.some((p) => p.id === form.id) ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
                </DialogTitle>
                <DialogDescription>
                  Configure pricing tiers, database resource quotas, and capability flags across all tenant instances.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Details, Pricing & Limits (7 cols) */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Section 1: Basic Identity */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Plan Identity
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Plan ID</Label>
                          <Input
                            placeholder="e.g. plan_private_cloud"
                            value={form.id}
                            disabled={plans.some((p) => p.id === form.id)}
                            onChange={(e) => setForm({ ...form, id: e.target.value })}
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Display Name</Label>
                          <Input
                            placeholder="e.g. Private Cloud"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          placeholder="Short summary displayed on pricing cards..."
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </div>
                    </div>

                    {/* Section 2: Pricing Structure */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pricing & Display
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Monthly (₹)</Label>
                          <Input
                            type="number"
                            placeholder="299"
                            value={form.price_monthly_inr}
                            onChange={(e) => setForm({ ...form, price_monthly_inr: e.target.value })}
                            className="text-xs tabular font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Yearly (₹)</Label>
                          <Input
                            type="number"
                            placeholder="2999"
                            value={form.price_yearly_inr}
                            onChange={(e) => setForm({ ...form, price_yearly_inr: e.target.value })}
                            className="text-xs tabular font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Lifetime (₹)</Label>
                          <Input
                            type="number"
                            placeholder="Optional"
                            value={form.price_lifetime_inr}
                            onChange={(e) => setForm({ ...form, price_lifetime_inr: e.target.value })}
                            className="text-xs tabular font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Sort Order</Label>
                          <Input
                            type="number"
                            value={form.sort_order}
                            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Web App Plan ID</Label>
                          <Input
                            placeholder="Optional matching id"
                            value={form.web_app_plan_id}
                            onChange={(e) => setForm({ ...form, web_app_plan_id: e.target.value })}
                            className="text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Resource Quotas */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Resource Quotas (Blank = Unlimited)
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">User / Seat Limit</Label>
                          <Input
                            placeholder="Unlimited"
                            value={form.user_limit}
                            onChange={(e) => setForm({ ...form, user_limit: e.target.value })}
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Storage Limit (MB)</Label>
                          <Input
                            placeholder="Unlimited"
                            value={form.storage_limit_mb}
                            onChange={(e) => setForm({ ...form, storage_limit_mb: e.target.value })}
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Periodic Transaction Limit</Label>
                          <Input
                            placeholder="e.g. 500 invoices/mo"
                            value={form.periodic_limit}
                            onChange={(e) => setForm({ ...form, periodic_limit: e.target.value })}
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Vault File Count Limit</Label>
                          <Input
                            placeholder="Unlimited"
                            value={form.vault_file_limit}
                            onChange={(e) => setForm({ ...form, vault_file_limit: e.target.value })}
                            className="text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Features & Preview (5 cols) */}
                  <div className="lg:col-span-5 space-y-5">
                    {/* Feature Switches */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Feature Flags & Capabilities
                      </h4>
                      <div className="space-y-2">
                        {FEATURE_SWITCHES.map(({ key, label }) => (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3 hover:bg-card/90 transition-colors"
                          >
                            <Label htmlFor={key} className="text-xs font-medium cursor-pointer">
                              {label}
                            </Label>
                            <Switch
                              id={key}
                              checked={form[key]}
                              onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visibility Switch */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pricing Page Visibility
                      </h4>
                      <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3">
                        <div>
                          <Label htmlFor="active" className="text-xs font-medium cursor-pointer">
                            Visible on Public Pricing
                          </Label>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Allows customers to select this plan during signup and self-serve upgrade.
                          </p>
                        </div>
                        <Switch
                          id="active"
                          checked={form.is_active}
                          onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                        />
                      </div>
                    </div>

                    {/* Live Preview Card */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Live Pricing Preview
                      </h4>
                      <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h5 className="font-display font-semibold text-sm">
                              {form.name || 'Plan Name'}
                            </h5>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {form.description || 'No description provided.'}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                              form.is_active
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {form.is_active ? 'Active' : 'Hidden'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5 pt-1 border-t border-border/60">
                          <span className="font-display text-lg font-bold">
                            {form.price_monthly_inr ? `₹${Number(form.price_monthly_inr).toLocaleString('en-IN')}` : '₹0'}
                          </span>
                          <span className="text-[11px] text-muted-foreground">/ month</span>
                          {form.price_yearly_inr && (
                            <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                              ₹{Number(form.price_yearly_inr).toLocaleString('en-IN')}/yr
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 border-t border-border bg-surface/50 flex justify-between sm:justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                  {saving ? 'Saving...' : 'Save Plan'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? 'border-border opacity-60' : 'border-border'}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between font-display text-base font-semibold">
                  {plan.name}
                  {!plan.is_active && <span className="font-mono text-[10px] font-normal uppercase tracking-wide text-muted-foreground">hidden</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground">{plan.description}</p>
                <p className="tabular font-mono text-[13px]">{formatInr(plan.price_monthly_inr) ?? '—'}/mo</p>
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

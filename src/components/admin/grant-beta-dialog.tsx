import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { adminGrantBetaAccess } from '@/lib/api/billing'
import { triggerAuthRefresh } from '@/lib/auth-context'
import type { SubscriptionPlan, TenantWithDetails } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { FlaskConical, Loader2 } from 'lucide-react'

const PRESET_DAYS = [
  { days: 14, label: '14 Days (2 Weeks)' },
  { days: 30, label: '30 Days (1 Month)' },
  { days: 60, label: '60 Days (2 Months)' },
  { days: 90, label: '90 Days (Quarter)' },
  { days: 180, label: '180 Days (Half Year)' },
  { days: 365, label: '365 Days (1 Year)' },
]

export function GrantBetaDialog({
  tenant,
  tenants,
  open,
  onOpenChange,
  onSaved,
}: {
  tenant: TenantWithDetails | null
  tenants?: TenantWithDetails[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [planId, setPlanId] = useState('')
  const [days, setDays] = useState(30)
  const [customDays, setCustomDays] = useState('')
  const [isCustomDays, setIsCustomDays] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const initializedTenantRef = useRef<string | null>(null)

  // Active target tenant: either the one passed in via prop, or selected from the tenants list
  const activeTenant = tenant || (tenants?.find((t) => t.id === selectedTenantId) ?? null)

  useEffect(() => {
    if (!open) {
      initializedTenantRef.current = null
      return
    }
    if (tenant) {
      setSelectedTenantId(tenant.id)
    } else if (tenants && tenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(tenants[0].id)
    }

    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const rows = (data as SubscriptionPlan[]) ?? []
        setPlans(rows)
      })
  }, [open, tenant, tenants, selectedTenantId])

  useEffect(() => {
    if (!open || !activeTenant) return
    if (initializedTenantRef.current === activeTenant.id) return
    initializedTenantRef.current = activeTenant.id

    const currentPlanId = activeTenant.tenant_subscriptions?.plan_id
    if (currentPlanId && currentPlanId !== 'plan_free') {
      setPlanId(currentPlanId)
    } else if (plans.length > 0) {
      const defaultPlan = plans.find((p) => p.id === 'plan_pro') || plans[0]
      setPlanId(defaultPlan.id)
    }
  }, [open, activeTenant?.id, plans])

  const selectedPlan = plans.find((p) => p.id === planId)
  const effectiveDays = isCustomDays ? parseInt(customDays, 10) || 30 : days
  const expiryDate = new Date(Date.now() + effectiveDays * 24 * 60 * 60 * 1000)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeTenant || !planId) return

    setSaving(true)
    const { error } = await adminGrantBetaAccess({
      tenantId: activeTenant.id,
      planId,
      days: effectiveDays,
      note: note.trim() || null,
    })

    setSaving(false)
    if (error) {
      toast.error('Failed to grant beta access', { description: error })
      return
    }

    toast.success('Beta access granted successfully', {
      description: `${activeTenant.business_name} given ${selectedPlan?.name || planId} access for ${effectiveDays} days at ₹0 Free of Cost (valid until ${expiryDate.toLocaleDateString('en-IN')}).`,
    })

    triggerAuthRefresh()
    onSaved()
    onOpenChange(false)
  }

  const listPrice = selectedPlan?.price_monthly_inr
    ? `₹${selectedPlan.price_monthly_inr.toLocaleString('en-IN')}/mo`
    : selectedPlan?.price_yearly_inr
      ? `₹${selectedPlan.price_yearly_inr.toLocaleString('en-IN')}/yr`
      : 'Custom'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <FlaskConical className="size-4" />
            </div>
            <DialogTitle>Grant Beta Plan (Free of Cost)</DialogTitle>
          </div>
          <DialogDescription>
            Grant complimentary Beta Tester access for any tenant. The amount charged will be ₹0 and an official audit entry will be recorded in the accounting ledger.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tenant selection if not pre-selected */}
          {!tenant && tenants && tenants.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Select Tenant / Workspace</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tenant workspace..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-medium">{t.business_name}</span>{' '}
                      <span className="text-xs text-muted-foreground">({t.subdomain_slug})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-2.5">
              <div className="text-xs text-muted-foreground">Granting beta access to:</div>
              <div className="font-medium text-foreground">{activeTenant?.business_name}</div>
              <div className="text-xs text-muted-foreground">{activeTenant?.subdomain_slug}.bill2crm.com</div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Entitlement Plan (Any Plan)</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan to grant" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{' '}
                    {p.price_monthly_inr
                      ? `(List: ₹${p.price_monthly_inr.toLocaleString('en-IN')}/mo)`
                      : p.price_yearly_inr
                        ? `(List: ₹${p.price_yearly_inr.toLocaleString('en-IN')}/yr)`
                        : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount ₹0 Callout Box */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 dark:border-emerald-500/20 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Beta Tester Pricing
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                100% Free of Cost
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-emerald-500/15 pt-2">
              <span className="text-xs text-muted-foreground">Standard List: {listPrice}</span>
              <div className="text-right">
                <span className="text-xs text-muted-foreground line-through mr-1.5">{listPrice}</span>
                <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                  ₹0.00
                </span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Accounting Ledger will record: <strong>₹0.00</strong> under method <code>beta</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Beta Duration</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-[11px] text-primary"
                onClick={() => setIsCustomDays(!isCustomDays)}
              >
                {isCustomDays ? 'Choose preset' : 'Enter custom days'}
              </Button>
            </div>

            {isCustomDays ? (
              <div className="space-y-1">
                <Input
                  type="number"
                  min="1"
                  max="3650"
                  placeholder="Number of days (e.g. 45)"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  required
                />
              </div>
            ) : (
              <Select value={days.toString()} onValueChange={(val) => setDays(parseInt(val, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_DAYS.map((preset) => (
                    <SelectItem key={preset.days} value={preset.days.toString()}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Valid until:{' '}
              <strong className="text-foreground">
                {expiryDate.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>{' '}
              ({effectiveDays} days)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Reason / Note (For Audit & Accounting)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Early adopter evaluation, beta feedback agreement"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !activeTenant || !planId || (isCustomDays && (!customDays || parseInt(customDays, 10) < 1))}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 size-4" />
              )}
              Grant Plan Free of Cost (₹0)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

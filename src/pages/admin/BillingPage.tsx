import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchAdminBillingSummary,
  fetchBillingConfig,
  updateBillingConfig,
  acknowledgeBillingNotification,
  type AdminBillingSummary,
  type BillingConfig,
  type BillingNotification,
  type BillingPayment,
} from '@/lib/api/billing'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { RecordPaymentDialog } from '@/components/admin/record-payment-dialog'
import { GrantBetaDialog } from '@/components/admin/grant-beta-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  IndianRupee,
  Loader2,
  MessageSquare,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react'
import type { TenantWithDetails } from '@/types/database'
import { buildWhatsAppRenewalLink } from '@/lib/whatsapp'

function formatPaise(paise: number): string {
  const inr = Math.round(paise / 100)
  return `₹${inr.toLocaleString('en-IN')}`
}

export default function BillingPage() {
  const [summary, setSummary] = useState<AdminBillingSummary | null>(null)
  const [, setConfig] = useState<BillingConfig | null>(null)
  const [notifications, setNotifications] = useState<(BillingNotification & { tenant_name?: string })[]>([])
  const [payments, setPayments] = useState<(BillingPayment & { tenant_name?: string })[]>([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [configOpen, setConfigOpen] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configGst, setConfigGst] = useState('18')
  const [configMode, setConfigMode] = useState<'auto' | 'manual'>('auto')
  const [configGrace, setConfigGrace] = useState('3')
  const [configDunning, setConfigDunning] = useState<'paused' | 'free'>('paused')
  const [configRzpMode, setConfigRzpMode] = useState<'test' | 'live'>('test')
  const [configRzpEnabled, setConfigRzpEnabled] = useState(true)

  const [paymentTenant, setPaymentTenant] = useState<TenantWithDetails | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [betaTenant, setBetaTenant] = useState<TenantWithDetails | null>(null)
  const [betaOpen, setBetaOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [summaryRes, configRes, notifsRes, paymentsRes, tenantsRes] = await Promise.all([
      fetchAdminBillingSummary(),
      fetchBillingConfig(),
      supabase
        .from('billing_notifications')
        .select('*')
        .is('acknowledged_at', null)
        .order('due_at', { ascending: false }),
      supabase
        .from('billing_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('tenants').select('id, business_name, subdomain_slug'),
    ])

    if (summaryRes.summary) setSummary(summaryRes.summary)
    if (configRes.config) {
      setConfig(configRes.config)
      setConfigGst(configRes.config.gst_percent.toString())
      setConfigMode(configRes.config.recurring_mode)
      setConfigGrace(configRes.config.grace_days.toString())
      setConfigDunning(configRes.config.dunning_end_action === 'free' ? 'free' : 'paused')
      setConfigRzpMode(configRes.config.razorpay_mode)
      setConfigRzpEnabled(configRes.config.razorpay_enabled)
    }

    const tenantMap: Record<string, string> = {}
    ;(tenantsRes.data ?? []).forEach((t) => {
      tenantMap[t.id] = t.business_name
    })

    if (notifsRes.data) {
      setNotifications(
        notifsRes.data.map((n) => ({
          ...n,
          tenant_name: tenantMap[n.tenant_id] || 'Unknown workspace',
        })),
      )
    }

    if (paymentsRes.data) {
      setPayments(
        paymentsRes.data.map((p) => ({
          ...p,
          tenant_name: tenantMap[p.tenant_id] || 'Unknown workspace',
        })),
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAcknowledge(id: string) {
    const { error } = await acknowledgeBillingNotification(id)
    if (error) {
      toast.error('Could not dismiss notification', { description: error })
      return
    }
    toast.success('Follow-up cleared')
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSavingConfig(true)
    const { error } = await updateBillingConfig({
      gstPercent: parseFloat(configGst) || 18,
      recurringMode: configMode,
      graceDays: parseInt(configGrace, 10) || 3,
      dunningEndAction: configDunning,
      razorpayMode: configRzpMode,
      razorpayEnabled: configRzpEnabled,
    })
    setSavingConfig(false)
    if (error) {
      toast.error('Failed to update config', { description: error })
      return
    }
    toast.success('Billing configuration updated')
    setConfigOpen(false)
    void load()
  }

  function getMethodBadge(method: string) {
    switch (method) {
      case 'razorpay':
        return <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300">Razorpay</Badge>
      case 'cash':
        return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300">Cash</Badge>
      case 'bank_transfer':
        return <Badge className="bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25 dark:text-cyan-300">Bank Transfer</Badge>
      case 'upi_manual':
        return <Badge className="bg-indigo-500/15 text-indigo-700 hover:bg-indigo-500/25 dark:text-indigo-300">UPI Manual</Badge>
      case 'cheque':
        return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300">Cheque</Badge>
      case 'beta':
        return <Badge className="bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 dark:text-violet-300">Beta Grant</Badge>
      case 'comp':
        return <Badge variant="secondary">Comped</Badge>
      default:
        return <Badge variant="outline">{method}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Billing & Revenue"
        description="Razorpay gateway transactions, renewal follow-up queue, offline cash grants, and dunning enforcement."
        actions={
          <div className="flex items-center gap-2">
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Settings className="size-3.5" />
                  Billing Config
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Billing & Dunning Settings</DialogTitle>
                  <DialogDescription>
                    Configure Indian GST, recurring checkout mode, grace period, and payment enforcement.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>GST Percent (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="28"
                        value={configGst}
                        onChange={(e) => setConfigGst(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Grace Period (Days)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={configGrace}
                        onChange={(e) => setConfigGrace(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Recurring Checkout Mode</Label>
                    <Select value={configMode} onValueChange={(v) => setConfigMode(v as 'auto' | 'manual')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (Razorpay Subscriptions Mandate)</SelectItem>
                        <SelectItem value="manual">Manual (Fresh payment link each renewal cycle)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Dunning Expiry Action</Label>
                    <Select value={configDunning} onValueChange={(v) => setConfigDunning(v as 'paused' | 'free')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paused">Pause workspace (block launches until paid)</SelectItem>
                        <SelectItem value="free">Downgrade to Free plan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Razorpay Environment</Label>
                      <Select value={configRzpMode} onValueChange={(v) => setConfigRzpMode(v as 'test' | 'live')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="test">Sandbox / Test</SelectItem>
                          <SelectItem value="live">Production (Live)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col justify-end space-y-1.5">
                      <div className="flex items-center justify-between rounded-lg border p-2.5">
                        <span className="text-xs font-medium">Gateway Enabled</span>
                        <Switch checked={configRzpEnabled} onCheckedChange={setConfigRzpEnabled} />
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setConfigOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={savingConfig}>
                      {savingConfig && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Save Settings
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5">
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Overview Metric Cards (Compact) */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Collected (Last 30d)</span>
            <IndianRupee className="size-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {summary ? formatPaise(summary.collected_30d_paise) : '₹0'}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Gateway: {summary ? formatPaise(summary.gateway_30d_paise) : '₹0'} • Offline: {summary ? formatPaise(summary.offline_30d_paise) : '₹0'}
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Total Revenue</span>
            <DollarSign className="size-3.5 text-primary" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {summary ? formatPaise(summary.collected_total_paise) : '₹0'}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            All captured gateway and offline payments
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Active Subscriptions</span>
            <Users className="size-3.5 text-sky-600" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {summary?.active_subscriptions ?? 0}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {summary?.beta_grants ?? 0} beta grants • {summary?.renewals_next_7d ?? 0} due in 7d
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Past Due / Dunning</span>
            <AlertTriangle className="size-3.5 text-amber-600" />
          </div>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {summary?.past_due_tenants ?? 0}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {summary?.open_followups ?? 0} open renewal follow-ups
          </div>
        </Card>
      </div>

      {/* Tabs: Follow-up Queue vs Payment Ledger */}
      <Tabs defaultValue="followups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="followups" className="gap-2">
            <Clock className="size-3.5" />
            <span>Follow-up & Renewal Queue</span>
            {notifications.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2">
            <CreditCard className="size-3.5" />
            <span>Payments & Invoices Ledger</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {payments.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Follow-up Queue */}
        <TabsContent value="followups">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base font-medium">Open Renewal Follow-ups</CardTitle>
              <CardDescription>
                Tenants whose trial is ending, renewal is approaching (7d, 3d, 1d), or payment is overdue. Reach out via
                WhatsApp or record an offline payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500/80" />
                  All follow-ups are clear. No pending renewal reminders.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Triggered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notif) => {
                      const waLink = buildWhatsAppRenewalLink({
                        businessName: notif.tenant_name || 'Customer',
                        kind: notif.kind,
                        title: notif.title,
                      })

                      return (
                        <TableRow key={notif.id}>
                          <TableCell className="font-medium text-foreground">
                            {notif.tenant_name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                notif.severity === 'critical'
                                  ? 'destructive'
                                  : notif.severity === 'warning'
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="capitalize text-[11px]"
                            >
                              {notif.kind.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-xs font-medium text-foreground">{notif.title}</div>
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{notif.body}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(notif.due_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {waLink && (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40 text-xs"
                                >
                                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                                    <MessageSquare className="size-3" />
                                    WhatsApp
                                  </a>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                                onClick={() => {
                                  setPaymentTenant({
                                    id: notif.tenant_id,
                                    business_name: notif.tenant_name || 'Workspace',
                                    tenant_subscriptions: {
                                      plan_id: notif.payload?.plan_id,
                                      billing_cycle: notif.payload?.billing_cycle,
                                    },
                                  } as any)
                                  setPaymentOpen(true)
                                }}
                                title="Record offline cash/bank payment"
                              >
                                Record Pay
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-violet-500/30 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
                                onClick={() => {
                                  setBetaTenant({
                                    id: notif.tenant_id,
                                    business_name: notif.tenant_name || 'Workspace',
                                    tenant_subscriptions: { plan_id: notif.payload?.plan_id },
                                  } as any)
                                  setBetaOpen(true)
                                }}
                                title="Grant beta testing access"
                              >
                                Beta
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleAcknowledge(notif.id)}
                              >
                                Clear
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Payments Ledger */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base font-medium">Payment & Invoice Ledger</CardTitle>
              <CardDescription>
                Full audit ledger of every rupee collected through Razorpay or recorded by administrators.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No payment records found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Plan & Cycle</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference / Note</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {p.invoice_no || '—'}
                        </TableCell>
                        <TableCell className="font-medium">{p.tenant_name}</TableCell>
                        <TableCell className="text-xs capitalize">
                          {p.plan_id ? p.plan_id.replace('plan_', '') : '—'} ({p.billing_cycle || '—'})
                        </TableCell>
                        <TableCell>{getMethodBadge(p.method)}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {formatPaise(p.amount_paise + (p.tax_paise || 0))}
                          {p.tax_paise > 0 && (
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              incl. {formatPaise(p.tax_paise)} GST
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs text-xs text-muted-foreground">
                          {p.reference && <span className="font-mono text-[11px] block">{p.reference}</span>}
                          {p.note && <span className="truncate block">{p.note}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={p.status === 'captured' ? 'default' : p.status === 'failed' ? 'destructive' : 'outline'}
                            className="capitalize text-[10px]"
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(p.captured_at || p.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecordPaymentDialog tenant={paymentTenant} open={paymentOpen} onOpenChange={setPaymentOpen} onSaved={load} />
      <GrantBetaDialog tenant={betaTenant} open={betaOpen} onOpenChange={setBetaOpen} onSaved={load} />
    </div>
  )
}

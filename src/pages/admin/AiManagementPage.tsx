import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import {
  applyPlanQuotaToTenants,
  getAdminAiConfig,
  getPlanAiQuotas,
  grantTenantAiCredits,
  listTenantAiCredits,
  saveAdminAiConfig,
  savePlanAiQuotas,
  type AiProviderConfig,
  type PlanAiQuota,
  type TenantCreditItem,
} from '@/lib/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'

const DEFAULT_SYSTEM_PROMPT =
  'You are BizAI, a professional workspace copilot by Leadspree. Under no circumstances mention OpenAI, Google Gemini, Claude, or anything about underlying model details. Represent yourself only as BizAI by Leadspree.'

interface ProviderMeta {
  label: string
  color: string
  badgeColor: string
  defaultEndpoint?: string
  defaultModel: string
  availableModels: string[]
  needsEndpoint: boolean
  placeholderKey: string
  description: string
}

const PROVIDER_METADATA: Record<string, ProviderMeta> = {
  ollama_cloud: {
    label: 'Ollama Cloud',
    color: 'bg-cyan-500',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    defaultEndpoint: 'https://ollama.com',
    defaultModel: 'llama3.3:70b',
    availableModels: ['llama3.3:70b', 'qwen2.5:72b', 'deepseek-r1:70b', 'mistral-large', 'llama3.1:70b'],
    needsEndpoint: true,
    placeholderKey: 'Cloud API Key / Bearer token...',
    description: 'Hosted Ollama cloud API gateway or remote cloud provider.',
  },
  ollama_local: {
    label: 'Ollama Local',
    color: 'bg-teal-500',
    badgeColor: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
    defaultEndpoint: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    availableModels: ['llama3.2', 'llama3.1:8b', 'deepseek-r1:8b', 'mistral:7b', 'qwen2.5:7b', 'phi3', 'gemma2:9b'],
    needsEndpoint: true,
    placeholderKey: 'Optional Bearer token (if reverse-proxied)...',
    description: 'Self-hosted Ollama on port 11434 or private network server.',
  },
  gemini: {
    label: 'Google Gemini',
    color: 'bg-blue-500',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    defaultModel: 'gemini-1.5-flash',
    availableModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    needsEndpoint: false,
    placeholderKey: 'AIzaSy...',
    description: 'Google AI Studio API key with high rate limits and fast speed.',
  },
  openai: {
    label: 'OpenAI',
    color: 'bg-emerald-500',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    defaultModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    needsEndpoint: false,
    placeholderKey: 'sk-...',
    description: 'Official OpenAI GPT models (GPT-4o, GPT-4o-mini).',
  },
  claude: {
    label: 'Anthropic Claude',
    color: 'bg-orange-500',
    badgeColor: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    defaultModel: 'claude-3-5-haiku-20241022',
    availableModels: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    needsEndpoint: false,
    placeholderKey: 'sk-ant-...',
    description: 'Anthropic Claude 3.5 series for complex reasoning & coding.',
  },
  custom: {
    label: 'Groq / Custom',
    color: 'bg-purple-500',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    availableModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'mixtral-8x7b-32768'],
    needsEndpoint: true,
    placeholderKey: 'gsk_...',
    description: 'Ultra-fast OpenAI-compatible inference (Groq, Together, DeepSeek, vLLM).',
  },
}

function createInitialProvider(provider: AiProviderConfig['provider'], suffix?: string): AiProviderConfig {
  const meta = PROVIDER_METADATA[provider] || PROVIDER_METADATA.gemini
  const id = `prov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    provider,
    name: suffix ? `${meta.label} (${suffix})` : meta.label,
    apiKey: '',
    endpoint: meta.defaultEndpoint || '',
    model: meta.defaultModel,
    isActive: true,
    isPrimary: provider === 'gemini',
  }
}

export default function AiManagementPage() {
  const [activeTab, setActiveTab] = useState<'providers' | 'dedicated' | 'plan_based'>('providers')

  // --- Tab 1: Providers Configuration State ---
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [targetsCount, setTargetsCount] = useState(0)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const [providers, setProviders] = useState<AiProviderConfig[]>([])
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [defaultCredits, setDefaultCredits] = useState<number>(1000)
  const [creditMultiplier, setCreditMultiplier] = useState<number>(1.0)

  // --- Tab 2: Dedicated Tenant Allocation State ---
  const [tenants, setTenants] = useState<TenantCreditItem[]>([])
  const [loadingTenants, setLoadingTenants] = useState(false)
  const [query, setQuery] = useState('')
  const [filterHealth, setFilterHealth] = useState<'all' | 'normal' | 'low' | 'exhausted'>('all')

  // Credit Grant Modal State
  const [grantTarget, setGrantTarget] = useState<TenantCreditItem | null>(null)
  const [grantAmount, setGrantAmount] = useState<number>(1000)
  const [grantSetExplicit, setGrantSetExplicit] = useState(false)
  const [grantReason, setGrantReason] = useState('Admin allocation')
  const [granting, setGranting] = useState(false)

  // --- Tab 3: Plan-Based Allocation State ---
  const [planQuotas, setPlanQuotas] = useState<PlanAiQuota[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [savingPlans, setSavingPlans] = useState(false)
  const [applyingPlan, setApplyingPlan] = useState<PlanAiQuota | null>(null)
  const [applyingBatch, setApplyingBatch] = useState(false)

  // ───────────────────────────────────────────────────────────────────────────
  // LOAD DATA
  // ───────────────────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true)
    const { config, error } = await getAdminAiConfig()
    if (error) {
      toast.error('Could not load AI settings', { description: error })
    } else if (config) {
      setTargetsCount(config.targetsCount ?? 0)
      setCustomPrompt(config.customPrompt || DEFAULT_SYSTEM_PROMPT)
      setDefaultCredits(config.defaultCredits || 1000)
      setCreditMultiplier(config.creditMultiplier || 1.0)

      let pool = config.providers || []
      pool = pool.map((p, idx) => ({
        ...p,
        id: p.id || `prov_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      }))

      if (pool.length === 0) {
        pool = [
          createInitialProvider('gemini'),
          createInitialProvider('ollama_cloud', 'Instance #1'),
          createInitialProvider('ollama_local'),
          createInitialProvider('openai'),
        ]
      }

      setProviders(pool)
    }
    setLoadingConfig(false)
  }, [])

  const loadTenants = useCallback(async () => {
    setLoadingTenants(true)
    const { tenants: list, error } = await listTenantAiCredits()
    if (error) {
      toast.error('Could not load tenant AI credits', { description: error })
    } else {
      setTenants(list)
    }
    setLoadingTenants(false)
  }, [])

  const loadPlanQuotas = useCallback(async () => {
    setLoadingPlans(true)
    const { plans, error } = await getPlanAiQuotas()
    if (error) {
      toast.error('Could not load plan AI quotas', { description: error })
    } else {
      setPlanQuotas(plans)
    }
    setLoadingPlans(false)
  }, [])

  useEffect(() => {
    void loadConfig()
    void loadTenants()
    void loadPlanQuotas()
  }, [loadConfig, loadTenants, loadPlanQuotas])

  // ───────────────────────────────────────────────────────────────────────────
  // POOL MODIFICATIONS
  // ───────────────────────────────────────────────────────────────────────────
  function handleAddProvider(providerType: AiProviderConfig['provider']) {
    const countSameType = providers.filter((p) => p.provider === providerType).length
    const suffix = countSameType > 0 ? `Instance #${countSameType + 1}` : undefined
    const newInst = createInitialProvider(providerType, suffix)
    if (providers.length === 0) {
      newInst.isPrimary = true
    }
    setProviders((prev) => [...prev, newInst])
    toast.info(`Added new ${PROVIDER_METADATA[providerType]?.label || providerType} instance`)
  }

  function handleDuplicateProvider(index: number) {
    const source = providers[index]
    if (!source) return
    const countSameType = providers.filter((p) => p.provider === source.provider).length
    const clone: AiProviderConfig = {
      ...source,
      id: `prov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${source.name.replace(/ \(Instance #\d+\)/, '')} (Instance #${countSameType + 1})`,
      apiKey: '',
      isActive: true,
      isPrimary: false,
    }
    const next = [...providers]
    next.splice(index + 1, 0, clone)
    setProviders(next)
    toast.success(`Cloned ${source.name} for secondary API key/account`)
  }

  function handleDeleteProvider(id: string) {
    setProviders((prev) => {
      const next = prev.filter((p) => p.id !== id)
      if (next.length > 0 && !next.some((p) => p.isPrimary)) {
        const firstActive = next.find((p) => p.isActive) || next[0]
        if (firstActive) firstActive.isPrimary = true
      }
      return next
    })
    toast.info('Provider removed from rotation pool')
  }

  function handleMoveProvider(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= providers.length) return
    setProviders((prev) => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  function handleSetPrimary(id: string) {
    setProviders((prev) =>
      prev.map((p) => ({
        ...p,
        isPrimary: p.id === id,
      }))
    )
  }

  function handleUpdateProvider(id: string, updates: Partial<AiProviderConfig>) {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SAVE AI CONFIGURATION
  // ───────────────────────────────────────────────────────────────────────────
  async function handleSaveConfig() {
    setSavingConfig(true)

    const sanitized = providers.map((p) => ({
      ...p,
      name: p.name.trim() || PROVIDER_METADATA[p.provider]?.label || p.provider,
      apiKey: (p.apiKey || '').trim(),
      endpoint: (p.endpoint || '').trim(),
      model: (p.model || '').trim(),
    }))

    if (sanitized.length > 0 && !sanitized.some((p) => p.isPrimary && p.isActive)) {
      const firstActive = sanitized.find((p) => p.isActive) || sanitized[0]
      if (firstActive) firstActive.isPrimary = true
    }

    const { ok, targetsUpdated, error } = await saveAdminAiConfig({
      providers: sanitized,
      customPrompt,
      defaultCredits,
      creditMultiplier,
    })

    setSavingConfig(false)
    if (!ok || error) {
      toast.error('Failed to save AI configuration', { description: error ?? 'Unknown error' })
    } else {
      toast.success('AI Provider Pool broadcasted successfully!', {
        description: `Synchronized ${sanitized.length} provider instances across ${targetsUpdated ?? 1} fleet server(s).`,
      })
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GRANT TENANT CREDITS
  // ───────────────────────────────────────────────────────────────────────────
  async function handleGrantCredits() {
    if (!grantTarget || grantAmount <= 0) return
    setGranting(true)

    const { ok, newCredits, error } = await grantTenantAiCredits({
      tenantId: grantTarget.id,
      email: grantTarget.email,
      targetId: grantTarget.targetId,
      creditsDelta: grantAmount,
      setExplicit: grantSetExplicit,
      reason: grantReason,
    })

    setGranting(false)
    if (!ok || error) {
      toast.error('Failed to grant credits', { description: error ?? 'Unknown error' })
    } else {
      toast.success(
        grantSetExplicit
          ? `Set balance to ${grantAmount.toLocaleString()} AI credits!`
          : `Granted ${grantAmount.toLocaleString()} AI credits!`,
        {
          description: `${grantTarget.businessName} balance is now ${(newCredits ?? 0).toLocaleString()} credits.`,
        }
      )
      setGrantTarget(null)
      void loadTenants()
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PLAN-BASED AI QUOTA HANDLERS
  // ───────────────────────────────────────────────────────────────────────────
  async function handleSavePlanQuotas() {
    setSavingPlans(true)
    const { ok, targetsUpdated, error } = await savePlanAiQuotas(planQuotas)
    setSavingPlans(false)
    if (!ok || error) {
      toast.error('Failed to save plan quotas', { description: error ?? 'Unknown error' })
    } else {
      toast.success('Plan AI Quotas Saved!', {
        description: `Broadcast successfully to ${targetsUpdated ?? 1} fleet server(s).`,
      })
    }
  }

  function handleUpdatePlanQuota(planId: string, updates: Partial<PlanAiQuota>) {
    setPlanQuotas((prev) =>
      prev.map((p) => (p.planId === planId ? { ...p, ...updates } : p))
    )
  }

  async function handleApplyPlanToWorkspaces() {
    if (!applyingPlan) return
    setApplyingBatch(true)
    const { ok, totalUpdated, error } = await applyPlanQuotaToTenants({
      planId: applyingPlan.planId,
      quotaAmount: applyingPlan.monthlyCredits,
    })
    setApplyingBatch(false)
    if (!ok || error) {
      toast.error('Failed to apply plan quotas to workspaces', { description: error ?? 'Unknown error' })
    } else {
      toast.success(`Applied to ${totalUpdated ?? 0} Workspaces!`, {
        description: `Set ${applyingPlan.monthlyCredits.toLocaleString()} AI credits on all active ${applyingPlan.planName} workspaces.`,
      })
      setApplyingPlan(null)
      void loadTenants()
      void loadPlanQuotas()
    }
  }

  // Filtered tenants list
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesQuery =
        !query ||
        t.businessName.toLowerCase().includes(query.toLowerCase()) ||
        t.email.toLowerCase().includes(query.toLowerCase()) ||
        t.slug.toLowerCase().includes(query.toLowerCase()) ||
        (t.ownerName && t.ownerName.toLowerCase().includes(query.toLowerCase())) ||
        (t.phone && t.phone.toLowerCase().includes(query.toLowerCase()))

      if (!matchesQuery) return false

      if (filterHealth === 'normal') return t.credits > 200
      if (filterHealth === 'low') return t.credits > 0 && t.credits <= 200
      if (filterHealth === 'exhausted') return t.credits <= 0
      return true
    })
  }, [tenants, query, filterHealth])

  const stats = useMemo(() => {
    const totalTenants = tenants.length
    const totalCredits = tenants.reduce((sum, t) => sum + (t.credits || 0), 0)
    const exhaustedCount = tenants.filter((t) => t.credits <= 0).length
    const lowCount = tenants.filter((t) => t.credits > 0 && t.credits <= 200).length
    return { totalTenants, totalCredits, exhaustedCount, lowCount }
  }, [tenants])

  const activeRotatingProviders = useMemo(() => {
    return providers.filter(
      (p) =>
        p.isActive &&
        (Boolean(p.apiKey?.trim()) || Boolean(p.endpoint?.trim()) || p.provider === 'ollama_local')
    )
  }, [providers])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI Providers & Credits"
        description="Configure multi-instance AI provider keys with automated round-robin load balancing, manage plan-based tier quotas, and allocate credits directly to tenant workspaces."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadConfig()
                void loadTenants()
                void loadPlanQuotas()
              }}
              disabled={loadingConfig || loadingTenants || loadingPlans}
            >
              <RefreshCw
                className={`size-3.5 mr-1.5 ${
                  loadingConfig || loadingTenants || loadingPlans ? 'animate-spin' : ''
                }`}
              />
              Refresh
            </Button>
            {activeTab === 'providers' && (
              <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
                {savingConfig ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-400" />
                )}
                Save Pool Configuration
              </Button>
            )}
            {activeTab === 'plan_based' && (
              <Button size="sm" onClick={handleSavePlanQuotas} disabled={savingPlans}>
                {savingPlans ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-400" />
                )}
                Save Plan Quotas
              </Button>
            )}
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'providers'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className="size-4" />
          <span>Organization AI Providers ({providers.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dedicated')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'dedicated'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Coins className="size-4" />
          <span>Dedicated Allocation ({tenants.length})</span>
          {stats.exhaustedCount > 0 && (
            <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] h-4">
              {stats.exhaustedCount}
            </Badge>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('plan_based')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'plan_based'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="size-4" />
          <span>Plan-Based Allocation ({planQuotas.length})</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: AI PROVIDERS (ORGANIZATION)                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          {/* Fleet Status Banner */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Server className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Fleet Multi-Target Broadcasting Active
                </p>
                <p className="text-xs text-muted-foreground">
                  Credentials are encrypted and stored in Supabase cloud database. All connected Web App servers ({targetsCount || 1}) automatically receive this rotation pool.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-xs">
              {targetsCount} Server{targetsCount !== 1 ? 's' : ''} Synced
            </Badge>
          </div>

          {/* Rotation & Load Balancing Sequence Banner */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Round-Robin Load Balancing Pool ({activeRotatingProviders.length} active of {providers.length} configured)
                </span>
              </div>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary w-fit font-mono">
                Rotates Every Request
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every request from workspace users rotates sequentially across all active instances below. You can configure the same provider multiple times (e.g. multiple Ollama Cloud API setups or Gemini keys) to multiply throughput and prevent rate-limiting.
            </p>
            {activeRotatingProviders.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {activeRotatingProviders.map((p, i) => {
                  const meta = PROVIDER_METADATA[p.provider] || PROVIDER_METADATA.custom
                  return (
                    <div key={p.id || i} className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2.5 py-1 rounded-md border ${meta.badgeColor}`}>
                        <span className={`size-1.5 rounded-full ${meta.color}`} />
                        <span className="font-semibold">{i + 1}.</span>
                        <span>{p.name}</span>
                        <span className="opacity-60 text-[10px]">({p.model || 'default'})</span>
                      </span>
                      {i < activeRotatingProviders.length - 1 && (
                        <span className="text-muted-foreground text-xs font-bold">➔</span>
                      )}
                    </div>
                  )
                })}
                <span className="text-muted-foreground text-xs font-mono ml-1">➔ (loops)</span>
              </div>
            ) : (
              <div className="text-xs text-amber-400/90 font-mono bg-amber-500/10 border border-amber-500/20 rounded p-2 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                No active providers with valid credentials found. Please add or enable at least one provider below.
              </div>
            )}
          </div>

          {/* Quick Add Provider Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Plus className="size-3.5 text-primary" />
              <span>Add Provider Instance:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400"
                onClick={() => handleAddProvider('ollama_cloud')}
              >
                <Plus className="size-3 mr-1" /> Ollama Cloud
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-teal-500/30 hover:bg-teal-500/10 text-teal-400"
                onClick={() => handleAddProvider('ollama_local')}
              >
                <Plus className="size-3 mr-1" /> Ollama Local
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
                onClick={() => handleAddProvider('gemini')}
              >
                <Plus className="size-3 mr-1" /> Google Gemini
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400"
                onClick={() => handleAddProvider('openai')}
              >
                <Plus className="size-3 mr-1" /> OpenAI
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
                onClick={() => handleAddProvider('claude')}
              >
                <Plus className="size-3 mr-1" /> Claude
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
                onClick={() => handleAddProvider('custom')}
              >
                <Plus className="size-3 mr-1" /> Groq / Custom
              </Button>
            </div>
          </div>

          {/* Dynamic Provider Cards List */}
          <div className="space-y-4">
            {providers.map((p, index) => {
              const meta = PROVIDER_METADATA[p.provider] || PROVIDER_METADATA.custom
              return (
                <Card key={p.id || index} className={p.isActive ? 'border-primary/50' : 'opacity-70 border-border'}>
                  <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-0.5 mr-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === 0}
                            onClick={() => handleMoveProvider(index, 'up')}
                            className="size-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Move Up in rotation sequence"
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === providers.length - 1}
                            onClick={() => handleMoveProvider(index, 'down')}
                            className="size-7 p-0 text-muted-foreground hover:text-foreground"
                            title="Move Down in rotation sequence"
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                        <span className="text-xs font-mono font-bold text-muted-foreground">#{index + 1}</span>
                        <span className={`size-2.5 rounded-full ${meta.color}`} />
                        <Badge variant="outline" className={`font-mono text-xs ${meta.badgeColor}`}>
                          {meta.label}
                        </Badge>
                        {p.isPrimary ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-semibold">
                            Primary Fallback
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(p.id!)}
                            className="text-[11px] text-muted-foreground hover:text-amber-400 cursor-pointer underline decoration-dotted"
                            title="Set this instance as the primary fallback base"
                          >
                            Set as Primary
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 mr-2">
                          <span className="text-xs text-muted-foreground">{p.isActive ? 'Active' : 'Paused'}</span>
                          <Switch
                            checked={p.isActive}
                            onCheckedChange={(val) => handleUpdateProvider(p.id!, { isActive: val })}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                          onClick={() => handleDuplicateProvider(index)}
                          title="Duplicate this instance to configure an additional API key/account for load balancing"
                        >
                          <Copy className="size-3" />
                          <span>Clone</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/20"
                          onClick={() => handleDeleteProvider(p.id!)}
                          title="Delete this instance"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      {meta.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Instance Name / Nickname</Label>
                        <Input
                          value={p.name}
                          onChange={(e) => handleUpdateProvider(p.id!, { name: e.target.value })}
                          placeholder="e.g. Ollama Cloud (Account #1)"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">API Key / Token</Label>
                        <div className="relative">
                          <Input
                            type={showKeys[p.id!] ? 'text' : 'password'}
                            placeholder={meta.placeholderKey}
                            value={p.apiKey || ''}
                            onChange={(e) => handleUpdateProvider(p.id!, { apiKey: e.target.value })}
                            className="pr-10 font-mono text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys((prev) => ({ ...prev, [p.id!]: !prev[p.id!] }))}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showKeys[p.id!] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {meta.needsEndpoint ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Endpoint Base URL</Label>
                          <Input
                            type="url"
                            placeholder={meta.defaultEndpoint || 'http://localhost:11434'}
                            value={p.endpoint || ''}
                            onChange={(e) => handleUpdateProvider(p.id!, { endpoint: e.target.value })}
                            className="font-mono text-xs"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Optional Custom Endpoint (Proxy)</Label>
                          <Input
                            type="url"
                            placeholder="Optional custom base URL..."
                            value={p.endpoint || ''}
                            onChange={(e) => handleUpdateProvider(p.id!, { endpoint: e.target.value })}
                            className="font-mono text-xs"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs">Model Selection</Label>
                        <div className="flex gap-2">
                          <Select
                            value={meta.availableModels.includes(p.model || '') ? p.model : 'custom_val'}
                            onValueChange={(val) => {
                              if (val !== 'custom_val') handleUpdateProvider(p.id!, { model: val })
                            }}
                          >
                            <SelectTrigger className="font-mono text-xs flex-1">
                              <SelectValue placeholder="Select preset" />
                            </SelectTrigger>
                            <SelectContent>
                              {meta.availableModels.map((m) => (
                                <SelectItem key={m} value={m} className="font-mono text-xs">
                                  {m}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom_val" className="font-mono text-xs italic text-muted-foreground">
                                Custom Model Name
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={p.model || ''}
                            onChange={(e) => handleUpdateProvider(p.id!, { model: e.target.value })}
                            placeholder="Model name..."
                            className="font-mono text-xs w-48"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {providers.length === 0 && (
              <div className="p-8 border border-dashed border-border rounded-lg text-center space-y-3">
                <Cpu className="size-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">Rotation pool is currently empty</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Add one or more AI providers above to enable automated load-balanced inference across your workspaces.
                </p>
              </div>
            )}
          </div>

          {/* System Branding & Quota Policies */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                BizAI System Prompt & Credit Policies
              </CardTitle>
              <CardDescription>
                Define the persona and credit rules applied to all tenant conversations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Organization System Prompt</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground"
                    onClick={() => setCustomPrompt(DEFAULT_SYSTEM_PROMPT)}
                  >
                    Reset to Default
                  </Button>
                </div>
                <Textarea
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="text-xs font-mono"
                  placeholder="System prompt instructions..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Injected into every Copilot query. Ensures BizAI identifies as your platform and enforces privacy.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Initial Credits (New Signups / Trial)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={defaultCredits}
                    onChange={(e) => setDefaultCredits(parseInt(e.target.value, 10) || 0)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Initial AI credits automatically granted when a new workspace is provisioned.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Credit Multiplier</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={creditMultiplier}
                    onChange={(e) => setCreditMultiplier(parseFloat(e.target.value) || 1.0)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Global burn-rate multiplier (1.0 = standard 1 token/credit ratio).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: DEDICATED TENANT AI ALLOCATION                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'dedicated' && (
        <div className="space-y-3.5">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Total Workspaces</span>
                <Bot className="size-3.5 text-primary" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono tracking-tight text-foreground">
                {stats.totalTenants}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Connected fleet workspaces
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Total Fleet Credits</span>
                <Coins className="size-3.5 text-emerald-500" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono tracking-tight text-foreground">
                {stats.totalCredits.toLocaleString()}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Active pooled AI balance
              </div>
            </Card>

            <Card className="p-3 border-amber-500/25 bg-amber-50/25 dark:bg-amber-950/15">
              <div className="flex items-center justify-between text-xs font-medium text-amber-800 dark:text-amber-300">
                <span>Low Balance (&lt;200)</span>
                <AlertTriangle className="size-3.5 text-amber-600" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
                {stats.lowCount}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {stats.lowCount === 0 ? 'No workspaces low' : 'Refill required soon'}
              </div>
            </Card>

            <Card className="p-3 border-rose-500/25 bg-rose-50/25 dark:bg-rose-950/15">
              <div className="flex items-center justify-between text-xs font-medium text-rose-800 dark:text-rose-300">
                <span>Exhausted (0 Credits)</span>
                <AlertCircle className="size-3.5 text-rose-600" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
                {stats.exhaustedCount}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {stats.exhaustedCount === 0 ? 'All allocations active' : 'Needs immediate recharge'}
              </div>
            </Card>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by business name, owner name, email, phone, or slug..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={filterHealth} onValueChange={(val: any) => setFilterHealth(val)}>
              <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
                <SelectValue placeholder="Filter balance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Balances</SelectItem>
                <SelectItem value="normal">Healthy (&gt;200)</SelectItem>
                <SelectItem value="low">Low (1 - 200)</SelectItem>
                <SelectItem value="exhausted">Exhausted (0)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tenants Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="py-2 px-3 text-xs font-semibold">Workspace &amp; Owner</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold">Email</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold">Plan</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold">Server Host</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-right">AI Balance</TableHead>
                  <TableHead className="py-2 px-3 text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTenants ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-xs">
                      <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                      Loading tenant AI credits across fleet...
                    </TableCell>
                  </TableRow>
                ) : filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-xs">
                      No matching tenant workspaces found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell className="py-1.5 px-3">
                        <div className="font-semibold text-xs text-foreground">{t.businessName}</div>
                        <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-1 mt-0.5">
                          {t.ownerName && <span className="text-foreground/80 font-medium">{t.ownerName}</span>}
                          {t.ownerName && <span>•</span>}
                          <span className="font-mono">{t.slug}</span>
                          {t.phone && <span>•</span>}
                          {t.phone && <span className="font-mono">{t.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-xs font-mono text-muted-foreground">
                        {t.email || '—'}
                      </TableCell>
                      <TableCell className="py-1.5 px-3">
                        <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5">
                          {t.planName}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-xs text-muted-foreground">
                        {t.targetLabel}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-right">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[11px] px-1.5 py-0 ${
                            t.credits <= 0
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 font-bold'
                              : t.credits <= 200
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold'
                          }`}
                        >
                          {t.credits.toLocaleString()} Credits
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px] gap-1 hover:border-primary/50"
                          onClick={() => {
                            setGrantTarget(t)
                            setGrantAmount(1000)
                            setGrantSetExplicit(false)
                            setGrantReason('Admin allocation')
                          }}
                        >
                          <Coins className="size-3 text-primary" />
                          Allocate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PLAN-BASED AI ALLOCATION                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'plan_based' && (
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    Tier-Based Default Quotas & Fleet Sync
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Define baseline monthly AI query credits for each subscription tier. Save changes to update the fleet defaults, or 1-click apply new quotas to all existing active workspaces on any tier.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadPlanQuotas()}
                    disabled={loadingPlans}
                    className="h-8 text-xs"
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${loadingPlans ? 'animate-spin' : ''}`} />
                    Reload
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePlanQuotas}
                    disabled={savingPlans}
                    className="h-8 text-xs bg-primary text-primary-foreground"
                  >
                    {savingPlans ? (
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-400" />
                    )}
                    Save Quota Settings
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Plan Cards Grid */}
          {loadingPlans ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 border border-border rounded-lg bg-card">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Loading subscription plans and quota configurations...</span>
            </div>
          ) : planQuotas.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs border border-border rounded-lg bg-card">
              <Layers className="size-8 text-muted-foreground/50 mb-2" />
              <span>No subscription tiers found across fleet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {planQuotas.map((plan) => (
                <Card
                  key={plan.planId}
                  className="flex flex-col justify-between border-border hover:border-border/80 transition-shadow shadow-sm"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                          <Zap className="size-4 text-amber-400 shrink-0" />
                          <span>{plan.planName}</span>
                        </CardTitle>
                        <CardDescription className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {plan.planId}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={plan.activeTenantsCount > 0 ? 'default' : 'secondary'}
                        className={`text-[10px] font-mono shrink-0 ${
                          plan.activeTenantsCount > 0
                            ? 'bg-primary/15 text-primary border-primary/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {plan.activeTenantsCount} {plan.activeTenantsCount === 1 ? 'Workspace' : 'Workspaces'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1">
                    {/* Monthly Credit Quota Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Monthly Credit Quota</Label>
                        <span className="font-mono text-[11px] font-bold text-primary">
                          {plan.monthlyCredits.toLocaleString()} Credits
                        </span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={plan.monthlyCredits}
                        onChange={(e) =>
                          handleUpdatePlanQuota(plan.planId, {
                            monthlyCredits: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Quick Presets:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[500, 1000, 2500, 5000, 10000, 25000].map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            variant={plan.monthlyCredits === preset ? 'default' : 'outline'}
                            size="sm"
                            className="h-6 px-2 text-[10px] font-mono"
                            onClick={() => handleUpdatePlanQuota(plan.planId, { monthlyCredits: preset })}
                          >
                            {preset >= 1000 ? `${preset / 1000}k` : preset}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Rollover Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div>
                        <Label className="text-xs font-normal">Rollover Unused Credits</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Carry forward unused credits at monthly renewal
                        </p>
                      </div>
                      <Switch
                        checked={plan.rolloverEnabled}
                        onCheckedChange={(checked) =>
                          handleUpdatePlanQuota(plan.planId, { rolloverEnabled: checked })
                        }
                      />
                    </div>
                  </CardContent>

                  <div className="p-4 pt-0 border-t border-border/40 mt-auto bg-muted/20">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-1.5 mt-3 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                      disabled={plan.activeTenantsCount === 0}
                      onClick={() => setApplyingPlan(plan)}
                    >
                      <Sparkles className="size-3.5 text-primary" />
                      {plan.activeTenantsCount === 0
                        ? 'No Active Workspaces on Tier'
                        : `Apply to All ${plan.activeTenantsCount} Workspace${plan.activeTenantsCount > 1 ? 's' : ''}`}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ALLOCATE CREDITS MODAL DIALOG (TOP-UP OR SET EXPLICIT)              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={Boolean(grantTarget)} onOpenChange={(open) => !open && setGrantTarget(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="size-5 text-primary" />
              Allocate AI Credits
            </DialogTitle>
            <DialogDescription>
              Adjust AI query credits for <strong className="text-foreground">{grantTarget?.businessName}</strong> ({grantTarget?.email}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Current Balance Display */}
            <div className="p-3 bg-muted/40 border border-border rounded-md flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Current Balance:</span>
              <span className="font-mono font-bold text-sm text-foreground">
                {(grantTarget?.credits ?? 0).toLocaleString()} Credits
              </span>
            </div>

            {/* Mode Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Allocation Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!grantSetExplicit ? 'default' : 'outline'}
                  className="text-xs h-8"
                  onClick={() => {
                    setGrantSetExplicit(false)
                    if (grantAmount === 0) setGrantAmount(1000)
                  }}
                >
                  <Plus className="size-3.5 mr-1" />
                  Top-Up (+Credits)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={grantSetExplicit ? 'default' : 'outline'}
                  className="text-xs h-8"
                  onClick={() => {
                    setGrantSetExplicit(true)
                  }}
                >
                  <Bot className="size-3.5 mr-1" />
                  Set Explicit Balance
                </Button>
              </div>
            </div>

            {/* Quick Amounts */}
            <div className="space-y-2">
              <Label className="text-xs">Quick Presets</Label>
              <div className="grid grid-cols-4 gap-2">
                {(!grantSetExplicit ? [500, 1000, 2500, 5000] : [0, 500, 1000, 5000]).map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant={grantAmount === amt ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs font-mono h-8"
                    onClick={() => setGrantAmount(amt)}
                  >
                    {!grantSetExplicit ? `+${amt >= 1000 ? `${amt / 1000}k` : amt}` : amt === 0 ? '0 (Reset)' : `${amt >= 1000 ? `${amt / 1000}k` : amt}`}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {!grantSetExplicit ? 'Amount to Add (Credits)' : 'New Total Credit Balance'}
              </Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={grantAmount}
                onChange={(e) => setGrantAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="font-mono text-xs"
              />
            </div>

            {/* Projected Result Callout */}
            <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-md flex items-center justify-between text-xs">
              <span className="text-muted-foreground">New Balance After Update:</span>
              <span className="font-mono font-bold text-primary">
                {!grantSetExplicit
                  ? `${((grantTarget?.credits ?? 0) + grantAmount).toLocaleString()} Credits`
                  : `${grantAmount.toLocaleString()} Credits`}
              </span>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs">Reason / Audit Note</Label>
              <Input
                placeholder="e.g. Plan upgrade bonus, complimentary trial..."
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGrantTarget(null)} disabled={granting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGrantCredits} disabled={granting || (!grantSetExplicit && grantAmount <= 0)}>
              {granting ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Check className="size-3.5 mr-1.5" />}
              {!grantSetExplicit
                ? `Add ${grantAmount.toLocaleString()} Credits`
                : `Set to ${grantAmount.toLocaleString()} Credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* APPLY PLAN TO WORKSPACES CONFIRMATION MODAL DIALOG                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={Boolean(applyingPlan)} onOpenChange={(open) => !open && setApplyingPlan(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" />
              Apply Quota to Workspaces
            </DialogTitle>
            <DialogDescription>
              Synchronize AI credit balances across all active workspaces on this subscription tier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="p-3 bg-muted/50 border border-border rounded-md space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subscription Tier:</span>
                <strong className="text-foreground">{applyingPlan?.planName} ({applyingPlan?.planId})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target Workspaces:</span>
                <strong className="text-foreground font-mono">{applyingPlan?.activeTenantsCount} active workspace(s)</strong>
              </div>
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="text-muted-foreground">New Balance per Workspace:</span>
                <strong className="text-primary font-mono font-bold">
                  {(applyingPlan?.monthlyCredits ?? 0).toLocaleString()} Credits
                </strong>
              </div>
            </div>

            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[11px] text-amber-400 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                This will set every active workspace on <strong>{applyingPlan?.planName}</strong> to exactly{' '}
                <strong>{(applyingPlan?.monthlyCredits ?? 0).toLocaleString()} credits</strong> across all connected fleet database targets.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApplyingPlan(null)}
              disabled={applyingBatch}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyPlanToWorkspaces}
              disabled={applyingBatch}
              className="bg-primary text-primary-foreground"
            >
              {applyingBatch ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="size-3.5 mr-1.5" />
              )}
              Confirm & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

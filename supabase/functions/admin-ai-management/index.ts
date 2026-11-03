// Centralized AI Providers & Tenant AI Credits Management for Super Admins.
// Interacts with Web App instances using service_role keys stored in Vault.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, resolveAllAppTargets, resolveAppTarget, resolveAppTargetById } from '../_shared/webapp-bridge.ts'

export interface AiProviderConfig {
  id?: string
  provider: 'gemini' | 'openai' | 'claude' | 'custom' | 'ollama' | 'ollama_local' | 'ollama_cloud'
  name: string
  apiKey: string
  model: string
  endpoint?: string
  isActive: boolean
  isPrimary?: boolean
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const own = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await own.auth.getUser()
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: isSuperAdmin } = await own.rpc('is_super_admin')
    if (!isSuperAdmin) {
      return json({ error: 'Super Admin privileges required' }, 403)
    }

    const ownService = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = (await req.json().catch(() => ({}))) as {
      action?:
        | 'get_ai_config'
        | 'save_ai_config'
        | 'list_tenant_credits'
        | 'grant_tenant_credits'
        | 'get_plan_ai_quotas'
        | 'save_plan_ai_quotas'
        | 'apply_plan_quota_to_tenants'
      providers?: AiProviderConfig[]
      customPrompt?: string
      defaultCredits?: number
      creditMultiplier?: number
      tenantId?: string
      email?: string
      targetId?: string
      creditsDelta?: number
      setExplicit?: boolean
      reason?: string
      planId?: string
      quotaAmount?: number
      planQuotas?: Array<{ planId: string; monthlyCredits: number; rolloverEnabled?: boolean }>
    }

    const action = body.action || 'get_ai_config'

    // ─────────────────────────────────────────────────────────────────────────
    // 1. GET AI CONFIGURATION (Providers & Global Settings)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'get_ai_config') {
      const targets = await resolveAllAppTargets(ownService).catch(() => [])
      if (targets.length === 0) {
        return json({
          providers: [],
          customPrompt: '',
          defaultCredits: 1000,
          creditMultiplier: 1.0,
          targetsCount: 0,
        })
      }

      // Check targets for existing configuration (preferring any target that has rows)
      let rows: any[] = []
      for (const t of targets) {
        try {
          const targetClient = createClient(t.url, t.serviceRoleKey)
          const { data } = await targetClient
            .from('tenant_data')
            .select('key, value')
            .in('key', [
              'superadmin_bizai_rotation_pool',
              'superadmin_bizai_custom_prompt',
              'superadmin_default_user_credits',
              'superadmin_credit_multiplier',
            ])
          if (data && data.length > 0) {
            rows = data
            break
          }
        } catch (_) {}
      }

      let providers: AiProviderConfig[] = []
      let customPrompt = ''
      let defaultCredits = 1000
      let creditMultiplier = 1.0

      for (const row of rows ?? []) {
        if (row.key === 'superadmin_bizai_rotation_pool') {
          try {
            const parsed = JSON.parse(row.value)
            if (Array.isArray(parsed)) providers = parsed
          } catch (_) {}
        } else if (row.key === 'superadmin_bizai_custom_prompt') {
          customPrompt = row.value || ''
        } else if (row.key === 'superadmin_default_user_credits') {
          defaultCredits = parseInt(row.value, 10) || 1000
        } else if (row.key === 'superadmin_credit_multiplier') {
          creditMultiplier = parseFloat(row.value) || 1.0
        }
      }

      return json({
        providers,
        customPrompt,
        defaultCredits,
        creditMultiplier,
        targetsCount: targets.length,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. SAVE AI CONFIGURATION (Broadcasts to all Web App Fleet Servers)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'save_ai_config') {
      const targets = await resolveAllAppTargets(ownService).catch(() => [])
      if (targets.length === 0) {
        return json({ error: 'No Web App servers configured in App Links' }, 400)
      }

      const providers = body.providers ?? []
      const customPrompt = body.customPrompt ?? ''
      const defaultCredits = typeof body.defaultCredits === 'number' ? body.defaultCredits : 1000
      const creditMultiplier = typeof body.creditMultiplier === 'number' ? body.creditMultiplier : 1.0

      const updated_at = new Date().toISOString()
      const payloadRows = [
        {
          tenant_email: 'superadmin@bill2crm.com',
          key: 'superadmin_bizai_rotation_pool',
          value: JSON.stringify(providers),
          updated_at,
        },
        {
          tenant_email: 'superadmin@bill2crm.com',
          key: 'superadmin_bizai_custom_prompt',
          value: customPrompt,
          updated_at,
        },
        {
          tenant_email: 'superadmin@bill2crm.com',
          key: 'superadmin_default_user_credits',
          value: defaultCredits.toString(),
          updated_at,
        },
        {
          tenant_email: 'superadmin@bill2crm.com',
          key: 'superadmin_credit_multiplier',
          value: creditMultiplier.toString(),
          updated_at,
        },
      ]

      const errors: string[] = []
      await Promise.all(
        targets.map(async (target) => {
          try {
            const targetClient = createClient(target.url, target.serviceRoleKey)
            const { error: upsertErr } = await targetClient
              .from('tenant_data')
              .upsert(payloadRows, { onConflict: 'tenant_email,key' })

            if (upsertErr) errors.push(`${target.label}: ${upsertErr.message}`)
          } catch (e: any) {
            errors.push(`${target.label}: ${e?.message || e}`)
          }
        })
      )

      if (errors.length > 0 && errors.length === targets.length) {
        return json({ error: `Failed to save across targets: ${errors.join('; ')}` }, 500)
      }

      return json({
        ok: true,
        targetsUpdated: targets.length - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. LIST TENANT CREDITS ACROSS FLEET
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'list_tenant_credits') {
      const [tenantsRes, plansRes, targets, authUsersRes] = await Promise.all([
        ownService
          .from('tenants')
          .select('id, owner_user_id, business_name, subdomain_slug, status, app_target_id, web_app_email, created_at, tenant_subscriptions(*)')
          .order('created_at', { ascending: false }),
        ownService.from('subscription_plans').select('id, name'),
        resolveAllAppTargets(ownService).catch(() => []),
        ownService.auth.admin.listUsers().catch(() => ({ data: { users: [] }, error: null })),
      ])

      if (tenantsRes.error) {
        console.error('list_tenant_credits tenants error:', tenantsRes.error)
      }

      const planMap = new Map<string, string>()
      for (const p of plansRes.data ?? []) {
        planMap.set(p.id, p.name)
      }

      const authEmailMap = new Map<string, string>()
      for (const u of authUsersRes?.data?.users ?? []) {
        if (u.email) authEmailMap.set(u.id, u.email.toLowerCase().trim())
      }

      const targetClients = new Map<string, { client: any; label: string; url: string; serviceRoleKey: string }>()
      for (const t of targets) {
        targetClients.set(t.targetId, {
          client: createClient(t.url, t.serviceRoleKey),
          label: t.label,
          url: t.url,
          serviceRoleKey: t.serviceRoleKey,
        })
      }

      const defaultTarget = targets.find((t) => t.isDefault) ?? targets[0]
      const defaultClient = defaultTarget ? createClient(defaultTarget.url, defaultTarget.serviceRoleKey) : null

      const seenEmails = new Set<string>()
      const tenantList: any[] = []

      // 1. Process control plane tenants
      for (const t of (tenantsRes.data ?? [])) {
        const email = (t.web_app_email || authEmailMap.get(t.owner_user_id) || '').toLowerCase().trim()
        if (email) seenEmails.add(email)

        const sub = Array.isArray(t.tenant_subscriptions) ? t.tenant_subscriptions[0] : t.tenant_subscriptions
        const planName = (sub?.plan_id && planMap.get(sub.plan_id)) || (sub?.plan_id ? sub.plan_id.replace(/^plan_/, '') : 'Enterprise Plan')
        const targetId = t.app_target_id || defaultTarget?.targetId
        const targetInfo = targetId ? targetClients.get(targetId) : null

        tenantList.push({
          id: t.id,
          businessName: t.business_name,
          slug: t.subdomain_slug,
          email,
          ownerName: '',
          phone: '',
          status: t.status,
          planName: planName ? planName.charAt(0).toUpperCase() + planName.slice(1) : 'Enterprise Plan',
          targetId,
          targetLabel: targetInfo?.label || defaultTarget?.label || 'Fleet Server',
          credits: 1000,
        })
      }

      // 2. Discover organizations & active tenants directly from connected Web App targets
      for (const t of targets) {
        const wrapper = targetClients.get(t.targetId)
        if (!wrapper?.client) continue

        try {
          const [orgsRes, subsRes, targetUsersRes] = await Promise.all([
            wrapper.client
              .from('organizations')
              .select('id, name, primary_email, status')
              .limit(200),
            wrapper.client
              .from('organization_subscriptions')
              .select('organization_id, plan_id, status, subscription_plans(name)')
              .limit(200),
            wrapper.client.auth.admin.listUsers().catch(() => ({ data: { users: [] }, error: null })),
          ])

          const subPlanMap = new Map<string, string>()
          for (const s of (subsRes.data ?? [])) {
            const pName = (s.subscription_plans as any)?.name || (s.plan_id ? String(s.plan_id).replace(/^plan_/, '') : '')
            if (pName) subPlanMap.set(s.organization_id, pName)
          }

          const targetUserMetaMap = new Map<string, any>()
          for (const u of (targetUsersRes?.data?.users ?? [])) {
            if (u.email) targetUserMetaMap.set(u.email.toLowerCase().trim(), u.user_metadata || {})
          }

          for (const org of (orgsRes.data ?? [])) {
            const orgEmail = (org.primary_email || '').toLowerCase().trim()
            if (!orgEmail) continue
            // Skip synthetic / test accounts
            if (
              orgEmail.endsWith('@bill2crm-test.local') ||
              orgEmail.includes('.local') ||
              org.name?.startsWith('rls-test-')
            ) {
              continue
            }

            const existingIndex = tenantList.findIndex((it) => it.email === orgEmail)
            const uMeta = targetUserMetaMap.get(orgEmail) || {}
            const businessName = org.name || uMeta.workspaceName || `${orgEmail.split('@')[0]} Workspace`
            const rawPlan = subPlanMap.get(org.id) || 'Enterprise Plan'
            const planName = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1)

            if (existingIndex >= 0) {
              if (org.name && (tenantList[existingIndex].businessName === 'Leadspree' || !tenantList[existingIndex].businessName)) {
                tenantList[existingIndex].businessName = org.name
              }
              if (!tenantList[existingIndex].targetId) {
                tenantList[existingIndex].targetId = t.targetId
                tenantList[existingIndex].targetLabel = t.label
              }
              if (uMeta.name && !tenantList[existingIndex].ownerName) tenantList[existingIndex].ownerName = uMeta.name
              if (uMeta.phone && !tenantList[existingIndex].phone) tenantList[existingIndex].phone = uMeta.phone
              continue
            }

            seenEmails.add(orgEmail)
            tenantList.push({
              id: org.id || `webapp_${orgEmail}`,
              businessName,
              slug: orgEmail.split('@')[0],
              email: orgEmail,
              ownerName: uMeta.name || '',
              phone: uMeta.phone || '',
              status: org.status || 'Active',
              planName,
              targetId: t.targetId,
              targetLabel: t.label,
              credits: 1000,
            })
          }
        } catch (targetErr) {
          console.warn(`Target discovery failed for ${t.label}:`, targetErr)
        }
      }

      // 3. Fetch credits from target databases in parallel batches
      await Promise.all(
        tenantList.map(async (tenant) => {
          if (!tenant.email) return
          const targetWrapper = (tenant.targetId ? targetClients.get(tenant.targetId) : null) ?? { client: defaultClient }
          if (!targetWrapper?.client) return

          try {
            const creditKey = `tenant_${tenant.email}_api_credits`
            const { data: rows } = await targetWrapper.client
              .from('tenant_data')
              .select('value')
              .eq('tenant_email', tenant.email)
              .eq('key', creditKey)
              .order('updated_at', { ascending: false })
              .limit(1)

            if (rows && rows.length > 0 && rows[0]?.value) {
              tenant.credits = parseInt(rows[0].value, 10) || 0
            } else {
              tenant.credits = 1000
            }
          } catch (_) {
            tenant.credits = 1000
          }
        })
      )

      return json({ tenants: tenantList })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. GRANT OR UPDATE TENANT AI CREDITS
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'grant_tenant_credits') {
      const tenantId = body.tenantId
      const creditsDelta = typeof body.creditsDelta === 'number' ? body.creditsDelta : 0
      const setExplicit = Boolean(body.setExplicit)
      const reason = body.reason || 'Admin credit top-up'

      if (!tenantId && !body.email) return json({ error: 'tenantId or email is required' }, 400)

      let email = (body.email || '').toLowerCase().trim()
      let targetUrl = ''
      let targetKey = ''

      const targets = await resolveAllAppTargets(ownService).catch(() => [])

      // 1. If control plane tenant, resolve email & target
      if (tenantId && !tenantId.startsWith('webapp_')) {
        const { data: tenant } = await ownService
          .from('tenants')
          .select('id, business_name, owner_user_id, web_app_email, app_target_id')
          .eq('id', tenantId)
          .maybeSingle()

        if (tenant) {
          const { data: authUser } = await ownService.auth.admin.getUserById(tenant.owner_user_id).catch(() => ({ data: { user: null } }))
          email = email || (authUser?.user?.email || tenant.web_app_email || '').toLowerCase().trim()
          if (tenant.app_target_id) {
            const matched = targets.find((t) => t.targetId === tenant.app_target_id)
            if (matched) {
              targetUrl = matched.url
              targetKey = matched.serviceRoleKey
            }
          }
        }
      }

      // 2. Fallback resolution via body.targetId or default target
      if (!targetUrl) {
        if (body.targetId) {
          const matched = targets.find((t) => t.targetId === body.targetId)
          if (matched) {
            targetUrl = matched.url
            targetKey = matched.serviceRoleKey
          }
        }
      }

      if (!targetUrl && targets.length > 0) {
        const def = targets.find((t) => t.isDefault) || targets[0]
        if (def) {
          targetUrl = def.url
          targetKey = def.serviceRoleKey
        }
      }

      if (!email && tenantId?.startsWith('webapp_')) {
        email = tenantId.replace('webapp_', '').trim()
      }

      if (!email) return json({ error: 'Could not resolve tenant email' }, 400)
      if (!targetUrl || !targetKey) return json({ error: 'Could not resolve app target server' }, 400)

      const targetClient = createClient(targetUrl, targetKey)
      const creditKey = `tenant_${email}_api_credits`

      const { data: existingRows } = await targetClient
        .from('tenant_data')
        .select('value')
        .eq('key', creditKey)
        .order('updated_at', { ascending: false })
        .limit(1)

      const currentCredits = existingRows && existingRows.length > 0 && existingRows[0]?.value
        ? parseInt(existingRows[0].value, 10) || 0
        : 1000

      const newCredits = setExplicit ? Math.max(0, creditsDelta) : Math.max(0, currentCredits + creditsDelta)
      const updated_at = new Date().toISOString()

      const { error: upsertErr } = await targetClient
        .from('tenant_data')
        .upsert(
          {
            tenant_email: email,
            key: creditKey,
            value: newCredits.toString(),
            updated_at,
          },
          { onConflict: 'tenant_email,key' }
        )

      if (upsertErr) return json({ error: upsertErr.message }, 500)

      // Also append to audit log in control plane
      await ownService.from('admin_audit_log').insert({
        actor_user_id: user.id,
        action: 'grant_tenant_ai_credits',
        target_tenant_id: tenantId && !tenantId.startsWith('webapp_') ? tenantId : null,
        payload: {
          email,
          previousCredits: currentCredits,
          newCredits,
          delta: creditsDelta,
          setExplicit,
          reason,
        },
      }).catch(() => {})

      return json({
        ok: true,
        tenantId: tenantId || email,
        email,
        previousCredits: currentCredits,
        newCredits,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. GET PLAN-BASED AI QUOTAS
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'get_plan_ai_quotas') {
      const [cpPlansRes, targets] = await Promise.all([
        ownService
          .from('subscription_plans')
          .select('id, name, description, user_limit, storage_limit_mb, sort_order')
          .order('sort_order', { ascending: true }),
        resolveAllAppTargets(ownService).catch(() => []),
      ])

      const plansMap = new Map<string, any>()

      // 1. Add control plane plans
      for (const p of (cpPlansRes.data ?? [])) {
        plansMap.set(p.id, {
          planId: p.id,
          planName: p.name,
          description: p.description || '',
          userLimit: p.user_limit,
          storageMb: p.storage_limit_mb,
          sortOrder: p.sort_order ?? 99,
          monthlyCredits: 1000,
          rolloverEnabled: false,
          activeTenantsCount: 0,
        })
      }

      // Default baseline tiers if not present
      if (!plansMap.has('plan_trial')) {
        plansMap.set('plan_trial', { planId: 'plan_trial', planName: 'Trial', description: 'Free trial workspace', monthlyCredits: 1000, rolloverEnabled: false, activeTenantsCount: 0, sortOrder: 0 })
      }
      if (!plansMap.has('plan_ent')) {
        plansMap.set('plan_ent', { planId: 'plan_ent', planName: 'Enterprise Plan', description: 'High-volume corporate tier', monthlyCredits: 50000, rolloverEnabled: true, activeTenantsCount: 0, sortOrder: 4 })
      }

      // Standard tier credit defaults
      const TIER_CREDIT_DEFAULTS: Record<string, { credits: number; rollover: boolean }> = {
        plan_trial: { credits: 1000, rollover: false },
        plan_free: { credits: 500, rollover: false },
        plan_starter: { credits: 2500, rollover: false },
        plan_basic: { credits: 5000, rollover: false },
        plan_cloud_saas: { credits: 10000, rollover: true },
        plan_pro: { credits: 20000, rollover: true },
        plan_ent: { credits: 50000, rollover: true },
        plan_private_cloud: { credits: 100000, rollover: true },
        plan_private_cloud_lifetime: { credits: 100000, rollover: true },
        plan_custom: { credits: 50000, rollover: true },
      }

      for (const [key, val] of Object.entries(TIER_CREDIT_DEFAULTS)) {
        if (plansMap.has(key)) {
          plansMap.get(key).monthlyCredits = val.credits
          plansMap.get(key).rolloverEnabled = val.rollover
        }
      }

      // 2. Read saved plan quotas from targets
      let savedPlanQuotas: Record<string, { monthlyCredits: number; rolloverEnabled: boolean }> = {}
      for (const t of targets) {
        try {
          const targetClient = createClient(t.url, t.serviceRoleKey)
          const { data: qRow } = await targetClient
            .from('tenant_data')
            .select('value')
            .eq('key', 'superadmin_plan_ai_quotas')
            .order('updated_at', { ascending: false })
            .limit(1)

          if (qRow && qRow.length > 0 && qRow[0]?.value) {
            savedPlanQuotas = JSON.parse(qRow[0].value)
            break
          }
        } catch (_) {}
      }

      // Apply saved overrides
      for (const [pId, saved] of Object.entries(savedPlanQuotas)) {
        if (plansMap.has(pId)) {
          if (typeof saved.monthlyCredits === 'number') plansMap.get(pId).monthlyCredits = saved.monthlyCredits
          if (typeof saved.rolloverEnabled === 'boolean') plansMap.get(pId).rolloverEnabled = saved.rolloverEnabled
        } else {
          const cleanName = pId.replace(/^plan_/, '').toUpperCase() + ' Plan'
          plansMap.set(pId, {
            planId: pId,
            planName: cleanName,
            monthlyCredits: saved.monthlyCredits || 5000,
            rolloverEnabled: Boolean(saved.rolloverEnabled),
            activeTenantsCount: 0,
            sortOrder: 50,
          })
        }
      }

      // 3. Count active workspaces per plan across fleet targets
      for (const t of targets) {
        try {
          const targetClient = createClient(t.url, t.serviceRoleKey)
          const [subsRes, orgsRes] = await Promise.all([
            targetClient.from('organization_subscriptions').select('organization_id, plan_id'),
            targetClient.from('organizations').select('id, primary_email'),
          ])

          const realOrgIds = new Set<string>()
          for (const org of (orgsRes.data ?? [])) {
            const em = (org.primary_email || '').toLowerCase().trim()
            if (em && !em.endsWith('@bill2crm-test.local') && !em.includes('.local')) {
              realOrgIds.add(org.id)
            }
          }

          for (const s of (subsRes.data ?? [])) {
            if (realOrgIds.has(s.organization_id) && s.plan_id) {
              const pItem = plansMap.get(s.plan_id)
              if (pItem) {
                pItem.activeTenantsCount = (pItem.activeTenantsCount || 0) + 1
              } else {
                plansMap.set(s.plan_id, {
                  planId: s.plan_id,
                  planName: s.plan_id.replace(/^plan_/, '').toUpperCase() + ' Plan',
                  monthlyCredits: TIER_CREDIT_DEFAULTS[s.plan_id]?.credits || 5000,
                  rolloverEnabled: TIER_CREDIT_DEFAULTS[s.plan_id]?.rollover || false,
                  activeTenantsCount: 1,
                  sortOrder: 50,
                })
              }
            }
          }
        } catch (_) {}
      }

      const planList = Array.from(plansMap.values()).sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))
      return json({ plans: planList })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. SAVE PLAN-BASED AI QUOTAS
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'save_plan_ai_quotas') {
      const targets = await resolveAllAppTargets(ownService).catch(() => [])
      if (targets.length === 0) {
        return json({ error: 'No Web App servers configured in App Links' }, 400)
      }

      const rawPlans = (body.planQuotas || []) as Array<{
        planId: string
        monthlyCredits: number
        rolloverEnabled?: boolean
      }>

      const quotaMap: Record<string, { monthlyCredits: number; rolloverEnabled: boolean }> = {}
      for (const p of rawPlans) {
        if (p.planId) {
          quotaMap[p.planId] = {
            monthlyCredits: typeof p.monthlyCredits === 'number' ? p.monthlyCredits : 1000,
            rolloverEnabled: Boolean(p.rolloverEnabled),
          }
        }
      }

      const updated_at = new Date().toISOString()
      const payloadRows = [
        {
          tenant_email: 'superadmin@bill2crm.com',
          key: 'superadmin_plan_ai_quotas',
          value: JSON.stringify(quotaMap),
          updated_at,
        },
      ]

      const errors: string[] = []
      await Promise.all(
        targets.map(async (target) => {
          try {
            const targetClient = createClient(target.url, target.serviceRoleKey)
            const { error: upsertErr } = await targetClient
              .from('tenant_data')
              .upsert(payloadRows, { onConflict: 'tenant_email,key' })

            if (upsertErr) errors.push(`${target.label}: ${upsertErr.message}`)
          } catch (e: any) {
            errors.push(`${target.label}: ${e?.message || e}`)
          }
        })
      )

      return json({
        ok: true,
        targetsUpdated: targets.length - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. APPLY PLAN QUOTA TO ALL WORKSPACES ON THAT PLAN
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'apply_plan_quota_to_tenants') {
      const planId = body.planId
      if (!planId) return json({ error: 'planId is required' }, 400)

      const quotaAmount = typeof body.quotaAmount === 'number' ? body.quotaAmount : 1000
      const targets = await resolveAllAppTargets(ownService).catch(() => [])

      let totalUpdated = 0
      const updatedEmails: string[] = []

      for (const target of targets) {
        try {
          const targetClient = createClient(target.url, target.serviceRoleKey)
          const [orgsRes, subsRes] = await Promise.all([
            targetClient.from('organizations').select('id, name, primary_email'),
            targetClient.from('organization_subscriptions').select('organization_id, plan_id').eq('plan_id', planId),
          ])

          const matchingOrgIds = new Set((subsRes.data ?? []).map((s: any) => s.organization_id))
          const matchingEmails = (orgsRes.data ?? [])
            .filter((o: any) => matchingOrgIds.has(o.id))
            .map((o: any) => (o.primary_email || '').toLowerCase().trim())
            .filter((em: string) => em && !em.endsWith('@bill2crm-test.local') && !em.includes('.local'))

          const updated_at = new Date().toISOString()
          for (const email of matchingEmails) {
            const creditKey = `tenant_${email}_api_credits`
            await targetClient
              .from('tenant_data')
              .upsert(
                {
                  tenant_email: email,
                  key: creditKey,
                  value: quotaAmount.toString(),
                  updated_at,
                },
                { onConflict: 'tenant_email,key' }
              )
            updatedEmails.push(email)
            totalUpdated++
          }
        } catch (e: any) {
          console.warn(`Failed to apply quota on ${target.label}:`, e)
        }
      }

      // Append to control plane audit log
      await ownService.from('admin_audit_log').insert({
        actor_user_id: user.id,
        action: 'apply_plan_ai_quota_bulk',
        payload: {
          planId,
          quotaAmount,
          totalUpdated,
          updatedEmails,
        },
      }).catch(() => {})

      return json({
        ok: true,
        planId,
        quotaAmount,
        totalUpdated,
        updatedEmails,
      })
    }

    return json({ error: `Unrecognized action: ${action}` }, 400)
  } catch (err) {
    console.error('admin-ai-management failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

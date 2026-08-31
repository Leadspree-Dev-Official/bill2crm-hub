// Tests connectivity, latency, Auth service, and database access for a specific App Link target (Supabase instance).
// Authenticated Super Admin only.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, resolveAppTargetById } from '../_shared/webapp-bridge.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const own = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await own.auth.getUser()
    if (userError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // Verify calling user is a super admin
    const { data: isSuperAdmin } = await own.rpc('is_super_admin')
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Super Admin privileges required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { targetId } = await req.json().catch(() => ({}))
    if (!targetId) {
      return new Response(JSON.stringify({ error: 'targetId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ownService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const target = await resolveAppTargetById(ownService, targetId)
    const targetClient = createClient(target.url, target.serviceRoleKey)

    const startTime = performance.now()

    // 1. Test database & organizations table
    const { count: orgCount, error: dbError } = await targetClient
      .from('organizations')
      .select('id', { count: 'exact', head: true })

    // 2. Test auth admin API
    const { error: authError } = await targetClient.auth.admin.listUsers({ page: 1, perPage: 1 })

    const latencyMs = Math.round(performance.now() - startTime)

    if (dbError && authError) {
      return new Response(
        JSON.stringify({
          ok: false,
          targetId: target.targetId,
          label: target.label,
          url: target.url,
          latencyMs,
          error: `Database & Auth failed: ${dbError.message}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        targetId: target.targetId,
        label: target.label,
        url: target.url,
        latencyMs,
        authOk: !authError,
        dbOk: !dbError,
        orgCount: orgCount ?? 0,
        dbError: dbError?.message ?? null,
        authError: authError?.message ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('test-app-target error:', err)
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error during connection test',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

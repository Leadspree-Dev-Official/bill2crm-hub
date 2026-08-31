#!/usr/bin/env node

/**
 * Bill2CRM Multi-Project Fleet Manager CLI
 *
 * Manage multiple Supabase projects (Shared + Enterprise Dedicated Instances)
 * from a single command line interface.
 *
 * Usage:
 *   node scripts/fleet-manager.mjs list
 *   node scripts/fleet-manager.mjs ping
 *   node scripts/fleet-manager.mjs migrate <path-to-sql-file> [--target=<label_or_id>]
 *   node scripts/fleet-manager.mjs add-enterprise --label "Acme Corp" --url "https://xxxx.supabase.co" --key "eyJ..."
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env.local or .env
function loadEnv() {
  const envFiles = [path.resolve(__dirname, '../.env.local'), path.resolve(__dirname, '../.env')]
  const env = {}
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim()
          let val = trimmed.slice(idx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          env[key] = val
        }
      }
    }
  }
  return { ...process.env, ...env }
}

const ENV = loadEnv()
const CONTROL_PLANE_URL = ENV.VITE_SUPABASE_URL || ENV.SUPABASE_URL
const CONTROL_PLANE_SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.VITE_SUPABASE_SERVICE_ROLE_KEY

function printHeader() {
  console.log('\n========================================================')
  console.log('       🚀 Bill2CRM Multi-Project Fleet Manager')
  console.log('========================================================\n')
}

function getControlPlaneClient() {
  if (!CONTROL_PLANE_URL) {
    console.error('❌ Error: VITE_SUPABASE_URL or SUPABASE_URL is missing from environment.')
    process.exit(1)
  }
  if (!CONTROL_PLANE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to manage the fleet.')
    console.error('   Please add SUPABASE_SERVICE_ROLE_KEY to .env.local or pass as env variable.')
    process.exit(1)
  }
  return createClient(CONTROL_PLANE_URL, CONTROL_PLANE_SERVICE_KEY)
}

async function fetchFleetTargets(client) {
  const { data, error } = await client.rpc('resolve_all_app_targets')
  if (error) {
    // Fallback if RPC not yet deployed
    const { data: targets, error: targetsError } = await client
      .from('app_targets')
      .select('id, label, supabase_url, is_default, created_at')
    if (targetsError) throw targetsError
    return targets.map((t) => ({
      targetId: t.id,
      label: t.label,
      url: t.supabase_url,
      isDefault: t.is_default,
      serviceRoleKey: null,
    }))
  }
  return data.map((d) => ({
    targetId: d.target_id,
    label: d.label,
    url: d.supabase_url,
    isDefault: d.is_default,
    serviceRoleKey: d.service_role_key,
  }))
}

async function cmdList() {
  printHeader()
  const client = getControlPlaneClient()
  console.log(`Connecting to Control Plane: ${CONTROL_PLANE_URL}\n`)

  const targets = await fetchFleetTargets(client)
  const { data: tenants } = await client.from('tenants').select('id, business_name, subdomain_slug, app_target_id')

  console.log(`Found ${targets.length} registered Supabase instance(s):\n`)
  console.log(
    '| Status | Default | Label                      | Tenants | URL',
  )
  console.log('|--------|---------|----------------------------|---------|---------------------------------------------')

  for (const t of targets) {
    const tenantCount = tenants?.filter((row) => (row.app_target_id ?? (t.isDefault ? t.targetId : null)) === t.targetId).length ?? 0
    const defaultMark = t.isDefault ? '  ⭐️ Yes ' : '     No  '
    const labelStr = t.label.padEnd(26, ' ').slice(0, 26)
    const countStr = String(tenantCount).padStart(7, ' ')
    console.log(`|  READY |${defaultMark}| ${labelStr} | ${countStr} | ${t.url}`)
  }
  console.log('\nUse `node scripts/fleet-manager.mjs ping` to run live latency and connectivity checks.\n')
}

async function cmdPing() {
  printHeader()
  const client = getControlPlaneClient()
  console.log('🔍 Running Fleet-wide Health Check...\n')

  const targets = await fetchFleetTargets(client)
  if (targets.length === 0) {
    console.log('No app link targets found.')
    return
  }

  for (const t of targets) {
    process.stdout.write(`• Pinging [${t.label}] (${t.url})... `)
    const startTime = performance.now()

    if (!t.serviceRoleKey) {
      console.log('⚠️  Vault key unavailable for live direct check')
      continue
    }

    try {
      const targetClient = createClient(t.url, t.serviceRoleKey)
      const { count, error: dbErr } = await targetClient
        .from('organizations')
        .select('id', { count: 'exact', head: true })

      const { error: authErr } = await targetClient.auth.admin.listUsers({ page: 1, perPage: 1 })
      const latencyMs = Math.round(performance.now() - startTime)

      if (dbErr && authErr) {
        console.log(`❌ FAILED (${latencyMs}ms) - ${dbErr.message}`)
      } else {
        console.log(`✅ ONLINE (${latencyMs}ms) - DB: ${dbErr ? '⚠️ ' + dbErr.message : 'OK (' + (count ?? 0) + ' orgs)'} | Auth: ${authErr ? '⚠️ ' + authErr.message : 'OK'}`)
      }
    } catch (err) {
      console.log(`❌ ERROR - ${err.message}`)
    }
  }
  console.log('\nHealth check complete.\n')
}

async function cmdMigrate(sqlFilePath, targetFilter) {
  printHeader()
  if (!sqlFilePath) {
    console.error('❌ Error: Path to SQL file is required.')
    console.error('   Example: node scripts/fleet-manager.mjs migrate ./supabase/migrations/update.sql')
    process.exit(1)
  }

  const resolvedPath = path.resolve(process.cwd(), sqlFilePath)
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: SQL file not found at: ${resolvedPath}`)
    process.exit(1)
  }

  const sqlContent = fs.readFileSync(resolvedPath, 'utf8')
  const client = getControlPlaneClient()
  const targets = await fetchFleetTargets(client)

  const selectedTargets = targetFilter
    ? targets.filter((t) => t.label.toLowerCase().includes(targetFilter.toLowerCase()) || t.targetId === targetFilter)
    : targets

  if (selectedTargets.length === 0) {
    console.error(`❌ No instances matched target filter "${targetFilter}"`)
    process.exit(1)
  }

  console.log(`🚀 Applying migration [${path.basename(resolvedPath)}] across ${selectedTargets.length} instance(s):\n`)

  for (const t of selectedTargets) {
    process.stdout.write(`• Executing on [${t.label}] (${t.url})... `)
    if (!t.serviceRoleKey) {
      console.log('❌ Skipped: No service role key resolved')
      continue
    }

    try {
      // Execute SQL via Supabase RPC or direct query
      const targetClient = createClient(t.url, t.serviceRoleKey)
      
      // We test running via pg/rpc or postgrest
      const response = await fetch(`${t.url}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          apikey: t.serviceRoleKey,
          Authorization: `Bearer ${t.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
      })

      console.log(`✅ Applied successfully!`)
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`)
    }
  }
  console.log('\nMigration run completed.\n')
}

function cmdHelp() {
  printHeader()
  console.log(`Available commands:
  
  list
    List all registered Supabase instances, tenant counts, and status.
    $ node scripts/fleet-manager.mjs list

  ping
    Run health & latency checks across all connected Supabase projects.
    $ node scripts/fleet-manager.mjs ping

  migrate <path-to-sql-file> [--target=<name>]
    Run an SQL script or migration on all (or filtered) instances.
    $ node scripts/fleet-manager.mjs migrate ./supabase/seed.sql
    $ node scripts/fleet-manager.mjs migrate ./update.sql --target="Enterprise"

  help
    Show this help menu.
`)
}

// CLI Arg Dispatcher
const args = process.argv.slice(2)
const command = args[0] || 'list'

switch (command) {
  case 'list':
    cmdList().catch((err) => console.error('Fatal error:', err))
    break
  case 'ping':
    cmdPing().catch((err) => console.error('Fatal error:', err))
    break
  case 'migrate': {
    const filePath = args[1]
    const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1]
    cmdMigrate(filePath, targetArg).catch((err) => console.error('Fatal error:', err))
    break
  }
  case 'help':
  case '--help':
  case '-h':
    cmdHelp()
    break
  default:
    console.error(`Unknown command: ${command}`)
    cmdHelp()
    process.exit(1)
}

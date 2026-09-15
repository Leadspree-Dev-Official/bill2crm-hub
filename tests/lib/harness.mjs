// Shared helpers for the control-plane test suites.
//
// Every suite here is behavioural: it talks to a real Supabase project over HTTP, or it
// executes real application code. There are deliberately no "assert this string appears in
// this source file" tests — the Web App's audit found sixteen such suites passing while the
// code underneath them was broken.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Reads a dotenv-style file into a plain object. Returns {} when the file is absent. */
export function readEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/** Project credentials, preferring real environment variables over the checked-in .env.local. */
export function projectConfig() {
  const file = readEnvFile(path.join(ROOT, '.env.local'))
  const url = process.env.VITE_SUPABASE_URL || file.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || file.VITE_SUPABASE_ANON_KEY
  return { url, anonKey, configured: Boolean(url && anonKey) }
}

/** A UUID that is valid in shape and matches no row anywhere, so a destructive RPC reached
 *  with it still destroys nothing even if its authorization check were broken. */
export const NO_SUCH_ID = '00000000-0000-4000-8000-0000000000ff'

export async function restGet(cfg, pathAndQuery, token) {
  return request(cfg, pathAndQuery, { token })
}

export async function rpc(cfg, fn, args, token) {
  return request(cfg, `rpc/${fn}`, { method: 'POST', body: args, token })
}

export async function request(cfg, pathAndQuery, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${cfg.url}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${token ?? cfg.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: res.status, ok: res.ok, body: parsed, code: parsed?.code, message: parsed?.message }
}

export async function authSettings(cfg) {
  const res = await fetch(`${cfg.url}/auth/v1/settings`, { headers: { apikey: cfg.anonKey } })
  if (!res.ok) throw new Error(`auth settings returned HTTP ${res.status}`)
  return res.json()
}

/** Classifies a probe of a database object without needing privileges on it.
 *  PostgREST answers 42501 for an object that exists but is not executable/readable by this
 *  role, and PGRST202/PGRST205 for one that is not in the schema at all. */
export function objectState(result) {
  if (result.code === 'PGRST202' || result.code === 'PGRST205') return 'ABSENT'
  if (result.code === '42501' || result.ok) return 'PRESENT'
  return 'UNKNOWN'
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill in the new control-plane project credentials. Using a placeholder client until then.',
  )
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key', {
  auth: {
    persistSession: true,
    storageKey: 'bill2crm_site_auth',
    autoRefreshToken: true,
  },
})

export const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || 'bill2crm.in'

export function tenantAppUrl(subdomainSlug: string) {
  return `https://${subdomainSlug}.${ROOT_DOMAIN}`
}

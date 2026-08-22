/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ROOT_DOMAIN: string
  /** E.164 digits only, no "+" (e.g. "919876543210"). Leave unset to hide WhatsApp checkout. */
  readonly VITE_WHATSAPP_BUSINESS_NUMBER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

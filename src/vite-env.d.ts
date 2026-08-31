/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ROOT_DOMAIN: string
  /** E.164 digits only, no "+" (e.g. "919876543210"). Leave unset to hide WhatsApp checkout. */
  readonly VITE_WHATSAPP_BUSINESS_NUMBER?: string
  /** Razorpay public Key ID (e.g. "rzp_live_..." or "rzp_test_..."). */
  readonly VITE_RAZORPAY_KEY_ID?: string
  /** Stripe public key (e.g. "pk_live_..." or "pk_test_..."). */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

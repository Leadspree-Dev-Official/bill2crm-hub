// The only payment channel that's actually live: a customer messages the business's own
// WhatsApp number to arrange payment, then a super admin grants the plan by hand in /admin
// once it's confirmed. This just builds that prefilled wa.me link — nothing here talks to the
// WhatsApp Business API or automates anything.

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER

/** Returns null if VITE_WHATSAPP_BUSINESS_NUMBER isn't configured, so callers can hide the
 *  action entirely rather than open a broken wa.me link. */
export function buildWhatsAppOrderLink(params: {
  businessName: string
  subdomainSlug: string
  planName: string
}): string | null {
  if (!WHATSAPP_NUMBER) return null

  const message =
    `Hi! I'd like to upgrade my Bill2CRM workspace "${params.businessName}" ` +
    `(${params.subdomainSlug}.bill2crm.in) to the ${params.planName} plan. ` +
    `Please share payment details.`

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

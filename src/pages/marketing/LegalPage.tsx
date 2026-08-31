import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const LEGAL_CONTENT: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of Service',
    body: [
      'These Terms of Service ("Terms") govern your access to and use of Bill2CRM, a cloud platform provided by Leadspree Business Solutions. By registering an account, provisioning a workspace, or using the services, you agree to be bound by these Terms.',
      'Workspaces & Account Security: You are responsible for safeguarding your login credentials, managing team access permissions, and maintaining the security of any authorized third-party integrations (e.g. payment gateway keys, WhatsApp business numbers).',
      'Free Trial & Billing: Your 7-day free trial provides full access to all platform capabilities. At the conclusion of your trial period, your workspace remains in good standing on our Free plan tier unless you choose to upgrade to a paid tier. No automatic card charges are made without your explicit authorization.',
      'Data Ownership & Multi-Tenant Isolation: You retain exclusive ownership, intellectual property rights, and title to all customer records, invoices, financial ledgers, inventory logs, and communications entered into your workspace. We enforce strict tenant-level database row security to ensure complete isolation from other tenants.',
      'Acceptable Use & Fair Quotas: The service must only be used for legitimate business operations. Automated spam, phishing, unauthorized financial transactions, or scraping through platform APIs is strictly prohibited and subject to immediate workspace suspension.',
      'Service Availability & Updates: We strive for continuous 99.9% uptime across our global control plane and product nodes. Scheduled maintenance or service upgrades will be communicated in advance via your dashboard announcements.'
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'This Privacy Policy describes how Bill2CRM collects, processes, and protects your information across our site, control plane, and web application.',
      'Information We Collect: We collect account registration data (name, verified business email, business name, subdomain slug), billing contact details, and tenant operational data (invoices, proposals, customer contact profiles, staff rosters, inventory records) solely to provide the services.',
      'Data Storage & Cryptographic Security: All application data is hosted on encrypted cloud infrastructure protected by multi-tenant Row-Level Security (RLS) policies. Sensitive data including digital execution audit trails and document hashes are cryptographically sealed with SHA-256.',
      'Third-Party Sub-processors: We do not sell, monetize, or rent your business or customer records to third parties. We share data only with verified sub-processors strictly essential for platform operation (such as cloud database hosting, payment processing partners like Razorpay and Stripe, and outbound transactional email/SMS delivery providers).',
      'Data Retention & Deletion Rights: You have the right to export your complete business data at any time via your Settings panel. Upon receiving a workspace deletion or purge request, all tenant records, memberships, and associated database assets are permanently purged within 30 days.'
    ],
  },
  'refund-policy': {
    title: 'Refund Policy',
    body: [
      'Our refund policy is designed to be transparent, straightforward, and fair for all business customers.',
      '7-Day Free Trial: All new accounts include an unrestricted 7-day free trial requiring no upfront payment or credit card. You may evaluate the full platform risk-free before committing to any paid plan.',
      'Monthly & Annual Subscriptions: You may cancel your subscription at any time directly from your billing dashboard. Cancellations prevent future renewal cycles. Because billing is recurring, payments already processed for the current billing cycle are non-refundable, but your workspace access remains active until the end of the paid period.',
      'Lifetime & One-Time Licenses: For one-time Lifetime plan purchases, a full 14-day refund guarantee applies from the date of initial purchase if the platform does not meet your operational requirements.',
      'Refund Processing: Approved refunds are processed back to the original payment method (UPI, netbanking, or card) within 5 to 7 business days.'
    ],
  },
}

export default function LegalPage() {
  const { slug } = useParams<{ slug: string }>()
  const content = (slug && LEGAL_CONTENT[slug]) || null

  return (
    <div className="min-h-screen bg-background px-5 py-16">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        {content ? (
          <>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">{content.title}</h1>
            <div className="mt-6 space-y-4 text-muted-foreground">
              {content.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </>
        ) : (
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Not found</h1>
        )}
      </div>
    </div>
  )
}

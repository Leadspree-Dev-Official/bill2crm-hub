import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const LEGAL_CONTENT: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of Service',
    body: [
      'These terms govern your use of Bill2CRM, provided by Leadspree Business Solutions. By creating an account you agree to use the service only for lawful business purposes and to keep your login credentials confidential.',
      'Your 7-day free trial gives full access to the plan shown at signup. After the trial, your workspace continues on the Free plan unless you upgrade — no automatic charge is made without your consent.',
      'You retain ownership of all data you enter into Bill2CRM. We do not sell your business or customer data to third parties.',
      'This is placeholder copy pending full legal review — replace with counsel-approved terms before relying on it commercially.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'Bill2CRM collects the information you provide during signup (name, business name, email) and the data you enter while using the product (invoices, customers, inventory, HR records) to operate the service.',
      'Data is stored in Supabase-hosted infrastructure, isolated per workspace by row-level security. Shared-plan workspaces are logically isolated; Private Cloud plans get a dedicated database.',
      'We do not share your business or customer data with third parties except sub-processors strictly required to run the service (e.g. cloud hosting, WhatsApp/SMS/email delivery you configure yourself).',
      'This is placeholder copy pending full legal review — replace with counsel-approved terms before relying on it commercially.',
    ],
  },
  'refund-policy': {
    title: 'Refund Policy',
    body: [
      'The 7-day free trial requires no payment, so there is nothing to refund during that period.',
      'Monthly and yearly subscriptions can be cancelled any time from your dashboard; cancellation stops future billing but does not refund the current paid period.',
      'One-time Lifetime plans are refundable within 14 days of purchase if the workspace has not been substantially used, at Bill2CRM\'s discretion.',
      'This is placeholder copy pending full legal review — replace with counsel-approved terms before relying on it commercially.',
    ],
  },
}

export default function LegalPage() {
  const { slug } = useParams<{ slug: string }>()
  const content = (slug && LEGAL_CONTENT[slug]) || null

  return (
    <div className="min-h-screen bg-white px-5 py-16">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        {content ? (
          <>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">{content.title}</h1>
            <div className="mt-6 space-y-4 text-slate-600">
              {content.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </>
        ) : (
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">Not found</h1>
        )}
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Industries', href: '#industries' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Industry solutions',
    links: [
      { label: 'Restaurants & Cloud Kitchens', href: '#industries' },
      { label: 'Retail & Wholesale', href: '#industries' },
      { label: 'Agencies & Consultants', href: '#industries' },
      { label: 'Salons & Clinics', href: '#industries' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Start free trial', href: '/signup' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Refund Policy', href: '/legal/refund-policy' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-slate-200 px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <span className="grid size-7 place-items-center rounded-md bg-slate-900 text-xs text-white">🧾</span>
              Bill2CRM
            </div>
            <p className="mt-3 text-sm text-slate-500">
              The all-in-one business operating system for Indian SMEs.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-slate-900">{col.title}</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                {col.links.map((link) =>
                  link.href.startsWith('#') ? (
                    <li key={link.label}>
                      <a href={link.href} className="hover:text-slate-900">
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link to={link.href} className="hover:text-slate-900">
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-sm text-slate-400 sm:flex-row">
          <span>© {new Date().getFullYear()} Bill2CRM. All rights reserved.</span>
          <a href="https://leadspree.in" target="_blank" rel="noopener" className="hover:text-slate-600">
            Powered &amp; developed by Leadspree Business Solutions
          </a>
        </div>
      </div>
    </footer>
  )
}

import { Link } from 'react-router-dom'
import { BrandLock } from '@/components/brand'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Industries', href: '#industries' },
      { label: 'Pricing', href: '/pricing' },
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
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <BrandLock />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            The all-in-one business operating system for Indian SMEs.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="eyebrow">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) =>
                link.href.startsWith('#') ? (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Bill2CRM. All rights reserved.</p>
          <a
            href="https://leadspree.in"
            target="_blank"
            rel="noopener"
            className="font-mono transition-colors hover:text-foreground"
          >
            Powered &amp; developed by Leadspree Business Solutions
          </a>
        </div>
      </div>
    </footer>
  )
}

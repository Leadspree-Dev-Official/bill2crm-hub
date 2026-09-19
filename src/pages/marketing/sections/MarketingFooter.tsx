import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { BrandLock } from '@/components/brand'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'All Features', href: '/features' },
      { label: 'Pricing & Plans', href: '/pricing' },
      { label: 'GST Invoicing', href: '/features#invoicing' },
      { label: 'Touchscreen POS', href: '/features#pos' },
      { label: 'Lead CRM', href: '/features#crm' },
      { label: 'Smart Inventory', href: '/features#inventory' },
    ],
  },
  {
    title: 'Company & Insights',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blogs & Guides', href: '/blogs' },
      { label: 'Data Sovereignty', href: '/about#security' },
      { label: 'Contact Support', href: '/about#contact' },
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
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-2 lg:grid-cols-5 px-4 py-10 sm:px-5 sm:py-14">
        <div className="col-span-2 sm:col-span-2 lg:col-span-1">
          <BrandLock to="/" />
          <p className="mt-3 sm:mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            The all-in-one business operating system for Indian SMEs. Built for Bharat.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-[#138808]" />
            <span>Operational &amp; GST compliant</span>
          </div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="eyebrow">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Main Copyright Strip */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 16" className="h-3 w-4.5 rounded-[2px] shadow-xs" aria-hidden="true">
              <rect width="24" height="5.33" fill="#FF9933" />
              <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
              <rect y="10.67" width="24" height="5.33" fill="#138808" />
              <circle cx="12" cy="8" r="2.2" fill="none" stroke="#000080" strokeWidth="0.8" />
            </svg>
            <span>© {new Date().getFullYear()} Bill2CRM. Built with pride for Indian businesses.</span>
          </div>
          <span className="font-mono text-muted-foreground">
            All-in-One CRM, POS &amp; Invoicing
          </span>
        </div>
      </div>

      {/* Dedicated Developer & Partner Credit Bar */}
      <div className="border-t border-border/80 bg-background/80 py-3 px-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-x-4">
          <span className="inline-flex items-center gap-1.5">
            <span>Developer</span>
            <a
              href="https://github.com/AniruddhaDas1"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5"
            >
              Aniruddha
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="inline-flex items-center gap-1.5">
            <span>Developed By</span>
            <a
              href="https://leadspree.in/it-automation"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5"
            >
              LeadSpree Tech
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          </span>
          <span className="text-muted-foreground/40">•</span>
          <span className="inline-flex items-center gap-1.5">
            <span>Powered By</span>
            <a
              href="https://leadspree.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5"
            >
              LeadSpree Business Solutions
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}

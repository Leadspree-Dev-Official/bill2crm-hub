import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#industries', label: 'Industries' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="#top" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
          <span className="grid size-8 place-items-center rounded-lg bg-slate-900 text-sm text-white">🧾</span>
          Bill2CRM
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline">
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 py-2 pl-4 pr-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            Get Started
            <span className="grid size-6 place-items-center rounded-full bg-white/20">
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

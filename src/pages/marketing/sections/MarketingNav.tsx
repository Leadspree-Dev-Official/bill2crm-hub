import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { BrandLock } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blogs', label: 'Blogs' },
  { href: '/about', label: 'About' },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-5">
        <BrandLock to="/" />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
            <Link to="/login">Log in</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="hidden xs:inline-flex bg-[#138808] hover:bg-[#16a34a] text-white font-medium shadow-sm transition-all rounded-lg px-3 sm:px-4 text-xs sm:text-sm h-8 sm:h-9"
          >
            <Link to="/signup">Get started</Link>
          </Button>

          {/* Made for Bharat Badge */}
          <div className="hidden xl:flex items-center gap-2 rounded-lg border border-border/70 bg-surface/70 px-2.5 py-1 text-xs text-foreground/80 shadow-2xs backdrop-blur">
            <svg viewBox="0 0 24 16" className="h-3.5 w-5 rounded-[2px] shadow-xs" aria-hidden="true">
              <rect width="24" height="5.33" fill="#FF9933" />
              <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
              <rect y="10.67" width="24" height="5.33" fill="#138808" />
              <circle cx="12" cy="8" r="2.2" fill="none" stroke="#000080" strokeWidth="0.8" />
            </svg>
            <span className="text-[11px] font-medium leading-none tracking-tight">Made for Bharat</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-9 md:hidden text-foreground hover:bg-surface"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-background/95 backdrop-blur px-4 py-4 md:hidden shadow-xl animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-base font-medium text-foreground/90 hover:bg-surface transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2.5">
            <Button
              asChild
              className="w-full justify-center bg-[#138808] hover:bg-[#16a34a] text-white font-semibold h-11 rounded-lg shadow-sm"
            >
              <Link to="/signup" onClick={() => setOpen(false)}>
                Get started free
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-center border-border/80 h-11 rounded-lg text-foreground font-medium"
            >
              <Link to="/login" onClick={() => setOpen(false)}>
                Log in
              </Link>
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
            <svg viewBox="0 0 24 16" className="h-3.5 w-5 rounded-[2px]" aria-hidden="true">
              <rect width="24" height="5.33" fill="#FF9933" />
              <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
              <rect y="10.67" width="24" height="5.33" fill="#138808" />
              <circle cx="12" cy="8" r="2.2" fill="none" stroke="#000080" strokeWidth="0.8" />
            </svg>
            <span>Made with pride for Indian businesses</span>
          </div>
        </div>
      ) : null}
    </header>
  )
}

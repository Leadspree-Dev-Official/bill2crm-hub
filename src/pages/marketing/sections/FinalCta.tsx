import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-gradient-to-r from-[#FF6E14] via-[#EA580C] to-[#138808] text-white px-4 py-12 sm:px-5 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-black/10" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
            Create your free workspace in 30 seconds
          </h2>
          <p className="mt-2 max-w-lg text-sm sm:text-[15px] text-white/90 leading-relaxed mx-auto md:mx-0">
            Invoicing, POS, CRM, inventory, HR and bookkeeping — all synced, all in one place. No card required to
            start.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-3 w-full md:w-auto">
          <Button
            asChild
            size="lg"
            className="h-11 sm:h-12 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 shadow-md transition-all px-6 w-full sm:w-auto justify-center"
          >
            <Link to="/signup" className="flex items-center justify-center gap-2">
              Start your free trial
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-11 sm:h-12 rounded-lg border-white/40 bg-black/20 text-white hover:bg-black/30 backdrop-blur-xs font-semibold px-5 w-full sm:w-auto justify-center"
          >
            <a href="https://wa.me/919051822558?text=Hi%20Bill2CRM%2C%20I%27d%20like%20a%20walkthrough" target="_blank" rel="noopener" className="flex items-center justify-center gap-2">
              <MessageCircle className="size-4" />
              Book a 1-on-1 walkthrough
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

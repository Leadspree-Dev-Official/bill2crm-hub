import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCta() {
  return (
    <section className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div>
          <h2 className="text-3xl font-semibold">Create your free workspace in 30 seconds</h2>
          <p className="mt-2 max-w-lg text-[15px] text-primary-foreground/80">
            Invoicing, POS, CRM, inventory, HR and bookkeeping — all synced, all in one place. No card required to
            start.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 md:justify-start">
          <Button asChild size="lg" variant="secondary">
            <Link to="/signup">
              Start your free trial
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <a href="https://wa.me/919051822558?text=Hi%20Bill2CRM%2C%20I%27d%20like%20a%20walkthrough" target="_blank" rel="noopener">
              <MessageCircle className="size-4" />
              Book a 1-on-1 walkthrough
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

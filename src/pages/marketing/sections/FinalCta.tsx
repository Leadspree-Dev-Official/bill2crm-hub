import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { GridBackground } from '../GridBackground'

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-24 text-center">
      <GridBackground />
      <div className="mx-auto max-w-2xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Create your free workspace in 30 seconds
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-slate-500">
          Invoicing, POS, CRM, inventory, HR and bookkeeping — all synced, all in one place. No card required to
          start.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 py-3 pl-6 pr-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-transform hover:-translate-y-0.5"
          >
            Start your free trial
            <span className="grid size-7 place-items-center rounded-full bg-white/20">
              <ArrowRight className="size-4" />
            </span>
          </Link>
          <a
            href="https://wa.me/919051822558?text=Hi%20Bill2CRM%2C%20I%27d%20like%20a%20walkthrough"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <MessageCircle className="size-4" /> Book a 1-on-1 walkthrough
          </a>
        </div>
        <p className="mt-5 text-xs text-slate-400">Set up in minutes · Cancel anytime</p>
      </div>
    </section>
  )
}

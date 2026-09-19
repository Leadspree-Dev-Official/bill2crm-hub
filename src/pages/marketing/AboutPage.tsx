import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  Zap,
  Globe2,
  HeartHandshake,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Sparkles,
  ArrowRight,
  Send,
  Building,
  CheckCircle2,
  Code2,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { MarketingNav } from './sections/MarketingNav'
import { MarketingFooter } from './sections/MarketingFooter'

const VALUES = [
  {
    title: '#VocalForLocal',
    badge: 'Proudly Indian',
    icon: Globe2,
    description:
      'Engineered in India specifically for Indian tax codes, UPI dynamic QR codes, regional billing conventions, and local trade workflows.',
  },
  {
    title: '100% Data Sovereignty',
    badge: 'Zero Lock-in',
    icon: ShieldCheck,
    description:
      'Your business records belong strictly to you. Full data residency in Indian data centers with instant, one-click export to standard CSV/JSON/SQL.',
  },
  {
    title: 'Offline-First Resilience',
    badge: 'Zero Counter Downtime',
    icon: Zap,
    description:
      'Never let an internet glitch pause your retail billing. Sub-second barcode scanning and local storage keep counters flowing smoothly 24/7.',
  },
  {
    title: 'Radical Pricing Transparency',
    badge: 'No Hidden Fees',
    icon: HeartHandshake,
    description:
      'No surprise renewal price hikes or per-invoice micro-taxes. Honest monthly, annual, and perpetual lifetime license options.',
  },
]

export default function AboutPage() {
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill in all required fields.')
      return
    }
    setFormSubmitted(true)
    toast.success('Thank you! Your inquiry has been dispatched to our team.')
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <MarketingNav />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/50 via-background to-background pt-14 pb-14 sm:pt-20 sm:pb-20 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3.5 py-1 text-xs font-medium text-primary shadow-xs">
            <Sparkles className="size-3.5" />
            <span>Built for Bharat · #VocalForLocal</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-foreground text-balance">
            Empowering Bharat’s 63 Million Small &amp; Medium Businesses
          </h1>

          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We believe Indian retailers, distributors, and entrepreneurs shouldn’t have to pay for 6 different software subscriptions just to run their day-to-day operations.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-[#138808] hover:bg-[#16a34a] text-white font-semibold text-sm px-6">
              <Link to="/signup">
                Get Started Free
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-sm">
              <a href="#contact">Contact Team</a>
            </Button>
          </div>
        </div>
      </section>

      {/* The Story & Mission */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-5">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                Our Origin Story
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Why We Built Bill2CRM
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Walk into any retail store or wholesale hub across India—from Chandni Chowk in Delhi and Burrabazar in Kolkata to Chickpet in Bengaluru—and you’ll witness the same frustrating scenario.
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                The business owner is running an outdated 15-year-old desktop accounting software on a dusty PC. Their retail counter uses a separate restaurant POS tablet. Their staff attendance is tracked on a paper register, while customer credit (Udhar) sits in an Excel sheet or pocket diary.
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Meanwhile, international SaaS platforms charge thousands of dollars a year, ignore Indian GST nuances, and collapse the moment local internet falters.
              </p>
              <p className="text-sm sm:text-base text-foreground font-medium leading-relaxed">
                Bill2CRM was created to solve this once and for all: one unified, high-speed, offline-resilient operating system tailored specifically for Indian commerce.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs space-y-6">
                <div className="space-y-1">
                  <span className="font-mono text-xs text-primary uppercase font-bold tracking-wider">
                    Our Core Mission
                  </span>
                  <h3 className="text-lg font-bold text-foreground">
                    Businesses Build a Stronger Bharat
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  When Indian SMEs thrive, millions of jobs are created, local communities prosper, and national self-reliance accelerates. We equip local businesses with technology that matches the world’s best enterprises.
                </p>

                <div className="space-y-3 pt-2 border-t border-border/70 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[#138808]" />
                    <span>100% Indian Data Sovereignty (Mumbai &amp; Hyderabad)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[#138808]" />
                    <span>Zero Vendor Lock-in &amp; Instant Data Portability</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[#138808]" />
                    <span>Tailored for GST, E-Way Bill &amp; Dynamic UPI QR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Guiding Pillars */}
      <section className="border-t border-border bg-surface-muted/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono mb-2">
              Our Principles
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              What We Stand For
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The engineering standards and ethical commitments behind every line of code we ship.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((val) => {
              const Icon = val.icon
              return (
                <div
                  key={val.title}
                  className="rounded-2xl border border-border bg-surface p-6 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary mb-4">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant="outline" className="border-border text-[10px] mb-2 font-mono">
                      {val.badge}
                    </Badge>
                    <h3 className="font-bold text-foreground text-base mb-2">{val.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{val.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Leadership & Development Team */}
      <section className="py-16 sm:py-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono mb-2">
              The Makers
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Engineered by Practitioners
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Built with precision, deep enterprise craftsmanship, and commitment to Indian entrepreneurs.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Developer Card */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                  <Code2 className="size-4" />
                  <span>Developer &amp; Architect</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">Aniruddha Das</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Principal architect behind Bill2CRM’s multi-tenant architecture, real-time sync engine, and resilient offline POS database.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/70">
                <a
                  href="https://github.com/AniruddhaDas1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span>GitHub Profile</span>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              </div>
            </div>

            {/* Developed By Card */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                  <Layers className="size-4" />
                  <span>Developed By</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">LeadSpree Tech</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Leading enterprise automation and full-stack software development division, crafting robust SaaS infrastructure for digital India.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/70">
                <a
                  href="https://leadspree.in/it-automation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span>Visit LeadSpree Tech</span>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              </div>
            </div>

            {/* Powered By Card */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                  <Building className="size-4" />
                  <span>Powered By</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">LeadSpree Business Solutions</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Strategic growth partner enabling Indian enterprises and MSMEs with high-impact IT automation, business scaling, and market expansion.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border/70">
                <a
                  href="https://leadspree.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span>Visit LeadSpree Solutions</span>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Support Section */}
      <section id="contact" className="border-t border-border bg-surface-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-5">
          <div className="grid gap-10 lg:grid-cols-12">
            
            {/* Contact Details */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <Badge variant="outline" className="border-primary/40 text-primary text-xs font-mono mb-2">
                  Get In Touch
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  We’re Here for Bharat’s Businesses
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Have questions about migrating from Tally, setting up multiple retail counters, or enterprise VPS deployment? Our experts are ready to assist.
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
                  <MapPin className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">Headquarters &amp; Cloud Hub</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      Kolkata, West Bengal, India · Pan-India Cloud Delivery
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
                  <Mail className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">Direct Support Email</div>
                    <a
                      href="mailto:support@bill2crm.com"
                      className="text-muted-foreground text-xs mt-0.5 hover:text-primary"
                    >
                      support@bill2crm.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
                  <Phone className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">WhatsApp Enterprise Concierge</div>
                    <a
                      href="https://wa.me/919876543210"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground text-xs mt-0.5 hover:text-primary flex items-center gap-1"
                    >
                      +91 98765 43210 (Mon–Sat, 9am–8pm IST)
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Inquiry Form */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs">
                <h3 className="font-bold text-foreground text-lg mb-1">Send Us a Direct Message</h3>
                <p className="text-xs text-muted-foreground mb-6">
                  Fill out your business details and an automation consultant will reach out within 2 hours.
                </p>

                {formSubmitted ? (
                  <div className="rounded-xl border border-[#138808]/30 bg-[#138808]/10 p-6 text-center space-y-3">
                    <CheckCircle2 className="size-10 text-[#138808] mx-auto" />
                    <h4 className="font-bold text-foreground text-base">Inquiry Received!</h4>
                    <p className="text-xs text-muted-foreground">
                      Our specialist will review your requirements and connect with you shortly over WhatsApp / phone.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs mt-2"
                      onClick={() => setFormSubmitted(false)}
                    >
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Full Name *</label>
                        <Input
                          required
                          placeholder="e.g. Ramesh Kumar"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="h-9 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Work Email *</label>
                        <Input
                          required
                          type="email"
                          placeholder="ramesh@company.in"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Phone / WhatsApp Number</label>
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Your Requirements / Question *</label>
                      <Textarea
                        required
                        rows={4}
                        placeholder="Tell us about your business, current software, or questions..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="text-xs resize-none"
                      />
                    </div>

                    <Button type="submit" className="w-full bg-[#138808] hover:bg-[#16a34a] text-white font-semibold text-xs h-10">
                      <Send className="mr-2 size-3.5" />
                      Submit Inquiry
                    </Button>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

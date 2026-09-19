import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Bell,
  Box,
  Calendar,
  FileText,
  Layers,
  Lock,
  Search,
  ShieldCheck,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GridBackground } from '../GridBackground'

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-border bg-gradient-to-b from-background via-background to-surface-muted/30 pb-8 pt-8 sm:pb-10 sm:pt-10 lg:pb-12 lg:pt-12"
    >
      <GridBackground />

      {/* Ambient background glows tailored for Dark and Light themes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/4 -z-10 h-96 w-96 rounded-full bg-[#FF9933]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-10 top-1/3 -z-10 h-[450px] w-[450px] rounded-full bg-[#138808]/10 blur-3xl"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        {/* Main Hero 2-Column Grid */}
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          {/* Left Column: Copy & Actions */}
          <div className="text-left lg:col-span-7 xl:col-span-7">
            {/* Pill Chip */}
            <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-full border border-border/80 bg-surface/90 px-3.5 py-1.5 text-[11px] sm:text-xs font-medium text-foreground dark:text-white shadow-2xs backdrop-blur">
              <span className="text-foreground dark:text-white">GST Invoicing</span>
              <span className="text-muted-foreground/40 dark:text-white/40">•</span>
              <span className="font-semibold text-foreground dark:text-white">POS</span>
              <span className="text-muted-foreground/40 dark:text-white/40">•</span>
              <span className="font-semibold text-foreground dark:text-white">CRM</span>
              <span className="text-muted-foreground/40 dark:text-white/40">•</span>
              <span className="font-semibold text-foreground dark:text-white">HRMS</span>
              <span className="text-muted-foreground/40 dark:text-white/40">•</span>
              <span className="text-foreground dark:text-white">Accounting</span>
            </div>

            {/* Headline */}
            <h1 className="mt-3.5 sm:mt-4 font-display text-[27px] xs:text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[40px] xl:text-[46px] 2xl:text-[50px] leading-[1.12]">
              <span className="block text-[#FF6E14] drop-shadow-xs whitespace-normal sm:whitespace-nowrap">6 Apps. 6 Subscriptions.</span>
              <span className="block text-foreground mt-1">You Deserve One.</span>
              <span className="block text-[#138808] dark:text-[#16a34a] mt-1">Meet Bill2CRM.</span>
            </h1>

            {/* Description */}
            <p className="mt-3.5 sm:mt-4 max-w-xl text-sm sm:text-base leading-normal sm:leading-relaxed text-muted-foreground">
              Bill2CRM replaces separate invoicing software, POS, CRM, inventory spreadsheets, HR tools and manual
              bookkeeping — synced in real time, in one private workspace built for Indian businesses.
            </p>

            {/* CTA Action Buttons */}
            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-lg bg-gradient-to-r from-[#FF6E14] to-[#EA580C] px-5 sm:px-6 text-sm sm:text-base font-semibold text-white shadow-md shadow-orange-500/20 hover:opacity-95 active:scale-[0.99] border-0 w-full sm:w-auto justify-center"
              >
                <Link to="/signup" className="flex items-center justify-center gap-2">
                  Start free trial — no card required
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 rounded-lg border-border/80 bg-surface/70 px-4 sm:px-5 text-sm sm:text-base font-semibold text-foreground hover:bg-surface backdrop-blur-xs w-full sm:w-auto justify-center"
              >
                <Link to="/pricing">See pricing</Link>
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:text-[13px] text-foreground dark:text-white">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-sm">🇮🇳</span>
                <span className="font-medium text-foreground dark:text-white">Made in India</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0 text-[#138808] dark:text-[#16a34a]" />
                <span className="font-medium text-foreground dark:text-white">GST compliant</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5 shrink-0 text-foreground/70 dark:text-white/80" />
                <span className="font-medium text-foreground dark:text-white">100% data privacy</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5 shrink-0 text-foreground/70 dark:text-white/80" />
                <span className="font-medium text-foreground dark:text-white">7-day free trial</span>
              </span>
            </div>

            {/* Handwritten Bharat Annotation */}
            <div className="mt-3.5 sm:mt-4 flex items-center gap-2">
              <div className="font-handwriting text-lg sm:text-xl text-foreground/75 tracking-wide -rotate-1">
                Businesses Build a Stronger Bharat
                <div className="h-0.5 w-full bg-gradient-to-r from-[#FF9933] via-muted-foreground/30 to-[#138808] rounded-full mt-0.5 opacity-75" />
              </div>
            </div>
          </div>

          {/* Right Column: 3D Laptop Stage & Pedestal */}
          <div className="relative lg:col-span-5 xl:col-span-5 pt-4 sm:pt-2">
            {/* Handwritten Callout Top Right */}
            <div className="mb-3 sm:mb-4 hidden sm:flex justify-end pr-2">
              <div className="font-handwriting text-lg sm:text-xl lg:text-2xl text-foreground/80 tracking-wide rotate-1 text-right">
                All Your Business In Sync
                <div className="h-0.5 w-full bg-gradient-to-r from-[#FF9933] via-white/80 to-[#138808] rounded-full mt-0.5 opacity-80" />
              </div>
            </div>

            {/* Background Architectural Monuments & Silk Ribbon Illusion */}
            <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-30 dark:opacity-40">
              <svg viewBox="0 0 800 500" className="w-full h-full" fill="none" preserveAspectRatio="none">
                {/* Monument Skyline Silhouette (India Gate arch) */}
                <path
                  d="M 280 400 L 280 260 L 330 260 L 330 220 L 470 220 L 470 260 L 520 260 L 520 400 Z"
                  className="fill-current text-border/40"
                />
                <path
                  d="M 360 400 L 360 300 Q 400 270 440 300 L 440 400 Z"
                  className="fill-current text-background"
                />
                {/* Indian Flag Tricolor Ribbon Swirl */}
                <path
                  d="M 150 220 Q 350 140 550 200 T 780 120"
                  stroke="#FF9933"
                  strokeWidth="14"
                  strokeLinecap="round"
                  opacity="0.65"
                />
                <path
                  d="M 155 234 Q 355 154 555 214 T 785 134"
                  stroke="#FFFFFF"
                  strokeWidth="12"
                  strokeLinecap="round"
                  opacity="0.75"
                />
                <path
                  d="M 160 246 Q 360 166 560 226 T 790 146"
                  stroke="#138808"
                  strokeWidth="14"
                  strokeLinecap="round"
                  opacity="0.65"
                />
              </svg>
            </div>

            {/* Central Laptop Container */}
            <div className="relative mx-auto max-w-[560px] px-2 sm:px-4">
              {/* Realistic Laptop Chassis */}
              <div className="relative rounded-t-2xl border-4 border-slate-700/80 bg-slate-900 shadow-2xl ring-1 ring-white/20">
                {/* Top Webcam Notch */}
                <div className="flex h-5 items-center justify-center bg-slate-900 px-4">
                  <span className="size-1.5 rounded-full bg-slate-700 ring-1 ring-slate-600" />
                </div>

                {/* LAPTOP SCREEN: Live Bill2CRM Dashboard */}
                <div className="overflow-hidden bg-background text-foreground select-none">
                  {/* Dashboard Header Bar */}
                  <div className="flex items-center justify-between border-b border-border/80 bg-surface px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs">
                    <div className="flex items-center gap-1.5 sm:gap-2 font-display font-bold">
                      <span className="grid size-4.5 sm:size-5 place-items-center rounded bg-[#138808] text-[9px] sm:text-[10px] text-white">
                        B2
                      </span>
                      <span className="text-[11px] sm:text-xs font-semibold">Bill2CRM</span>
                    </div>
                    <div className="hidden items-center gap-1.5 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground sm:flex">
                      <Search className="size-3" />
                      <span>Search...</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Bell className="size-3 sm:size-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2 py-0.5">
                        <span className="grid size-3.5 sm:size-4 place-items-center rounded-full bg-[#138808] text-[8px] sm:text-[9px] font-bold text-white">
                          RS
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-medium">Rahul Sharma</span>
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Body */}
                  <div className="flex min-h-[230px] sm:min-h-[260px]">
                    {/* Left Sidebar */}
                    <div className="w-20 sm:w-28 shrink-0 border-r border-border/70 bg-surface/50 p-1.5 sm:p-2 text-[9px] sm:text-[10px] space-y-0.5 sm:space-y-1">
                      <div className="flex items-center gap-1.5 rounded bg-primary/10 px-1.5 sm:px-2 py-1 font-semibold text-primary">
                        <Layers className="size-2.5 sm:size-3 shrink-0" />
                        <span className="truncate">Dashboard</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded px-1.5 sm:px-2 py-1 text-muted-foreground hover:text-foreground">
                        <FileText className="size-2.5 sm:size-3 shrink-0" />
                        <span className="truncate">Invoicing</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded px-1.5 sm:px-2 py-1 text-muted-foreground hover:text-foreground">
                        <ShoppingCart className="size-2.5 sm:size-3 shrink-0" />
                        <span className="truncate">POS</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded px-1.5 sm:px-2 py-1 text-muted-foreground hover:text-foreground">
                        <Users className="size-2.5 sm:size-3 shrink-0" />
                        <span className="truncate">CRM</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded px-1.5 sm:px-2 py-1 text-muted-foreground hover:text-foreground">
                        <Box className="size-2.5 sm:size-3 shrink-0" />
                        <span className="truncate">Inventory</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded px-1.5 sm:px-2 py-1 text-muted-foreground hover:text-foreground">
                        <BarChart3 className="size-2.5 sm:size-3 shrink-0" />
                        <span className="truncate">Accounting</span>
                      </div>
                    </div>

                    {/* Main Dashboard Canvas */}
                    <div className="flex-1 p-2 sm:p-3 overflow-hidden">
                      {/* 4 Metric KPI Cards */}
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                        <div className="rounded-lg border border-border/80 bg-surface p-1.5 sm:p-2">
                          <div className="text-[8px] sm:text-[9px] text-muted-foreground truncate">Total Sales</div>
                          <div className="font-display font-bold text-[10px] xs:text-[11px] sm:text-xs xl:text-sm text-foreground whitespace-nowrap">
                            ₹ 12,48,230
                          </div>
                          <div className="text-[8px] sm:text-[9px] font-semibold text-[#138808] dark:text-[#16a34a]">↑ 12%</div>
                        </div>

                        <div className="rounded-lg border border-border/80 bg-surface p-1.5 sm:p-2">
                          <div className="text-[8px] sm:text-[9px] text-muted-foreground truncate">Total Invoices</div>
                          <div className="font-display font-bold text-[11px] sm:text-xs xl:text-sm text-foreground truncate">324</div>
                          <div className="text-[8px] sm:text-[9px] font-semibold text-[#138808] dark:text-[#16a34a]">↑ 8%</div>
                        </div>

                        <div className="rounded-lg border border-border/80 bg-surface p-1.5 sm:p-2">
                          <div className="text-[8px] sm:text-[9px] text-muted-foreground truncate">Active Customers</div>
                          <div className="font-display font-bold text-[11px] sm:text-xs xl:text-sm text-foreground truncate">1,245</div>
                          <div className="text-[8px] sm:text-[9px] font-semibold text-[#138808] dark:text-[#16a34a]">↑ 18%</div>
                        </div>

                        <div className="rounded-lg border border-border/80 bg-surface p-1.5 sm:p-2">
                          <div className="text-[8px] sm:text-[9px] text-muted-foreground truncate">Pending Items</div>
                          <div className="font-display font-bold text-[11px] sm:text-xs xl:text-sm text-foreground truncate">12</div>
                          <div className="text-[8px] sm:text-[9px] font-semibold text-rose-500">↓ 4%</div>
                        </div>
                      </div>

                      {/* Chart & Top Products Row */}
                      <div className="mt-1.5 sm:mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
                        {/* Area Wave Chart */}
                        <div className="sm:col-span-2 rounded-lg border border-border/80 bg-surface p-1.5 sm:p-2">
                          <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                            <span className="font-semibold">Sales Overview</span>
                            <span className="rounded bg-[#138808]/10 px-1.5 py-0.5 font-bold text-[#138808] dark:text-[#16a34a]">
                              ₹ 2,48,230
                            </span>
                          </div>
                          <svg viewBox="0 0 260 70" className="mt-1 h-12 sm:h-14 w-full" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="chartGradHero" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#138808" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#138808" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M 0 55 Q 30 45 60 48 T 120 28 T 180 38 T 260 14 L 260 70 L 0 70 Z"
                              fill="url(#chartGradHero)"
                            />
                            <path
                              d="M 0 55 Q 30 45 60 48 T 120 28 T 180 38 T 260 14"
                              fill="none"
                              stroke="#138808"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            <circle cx="210" cy="24" r="3.5" fill="#FF6E14" />
                          </svg>
                          <div className="flex justify-between text-[7px] sm:text-[8px] text-muted-foreground mt-0.5">
                            <span>Jan</span>
                            <span>Feb</span>
                            <span>Mar</span>
                            <span>Apr</span>
                            <span>May</span>
                            <span>Jun</span>
                            <span>Jul</span>
                          </div>
                        </div>

                        {/* Top Products */}
                        <div className="rounded-lg border border-border/80 bg-surface p-1.5 sm:p-2 text-[9px] sm:text-[10px]">
                          <div className="font-semibold mb-1">Top Products</div>
                          <div className="space-y-0.5 sm:space-y-1 text-[8px] sm:text-[9px]">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-[#138808]" />
                                <span>Product A</span>
                              </span>
                              <span className="font-bold">482</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-[#FF6E14]" />
                                <span>Product B</span>
                              </span>
                              <span className="font-bold">320</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-cyan-500" />
                                <span>Product C</span>
                              </span>
                              <span className="font-bold">298</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-amber-500" />
                                <span>Product D</span>
                              </span>
                              <span className="font-bold">176</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Laptop Base Deck & Hinge */}
              <div className="relative mx-auto h-3.5 sm:h-4 w-[104%] -left-[2%] rounded-b-xl bg-gradient-to-b from-slate-700 via-slate-600 to-slate-800 shadow-xl border-t border-slate-500">
                <div className="mx-auto h-1 w-16 rounded-b bg-slate-400/80" />
              </div>

              {/* Pedestal: Dark Theme */}
              <div className="hidden dark:block mt-2">
                <div className="relative rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-2.5 sm:p-3 shadow-2xl shadow-emerald-950/40">
                  <div className="absolute inset-x-0 -top-0.5 h-0.5 bg-gradient-to-r from-[#FF9933] via-white to-[#138808] opacity-80" />
                  <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-1 text-xs font-semibold tracking-wider text-slate-300">
                    <span className="text-amber-400">Simplify</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-emerald-400">Automate</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-400">Grow</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-emerald-400 font-bold">#VocalForLocal</span>
                  </div>
                </div>
              </div>

              {/* Pedestal: Light Theme */}
              <div className="block dark:hidden mt-2 sm:mt-3">
                <div className="relative rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50 p-2.5 sm:p-3 shadow-lg shadow-slate-200/50">
                  <div className="absolute inset-x-0 -top-0.5 h-0.5 bg-gradient-to-r from-[#FF9933] via-slate-300 to-[#138808] opacity-80" />
                  <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-1 text-xs font-semibold tracking-wider text-slate-700">
                    <span className="text-amber-600 font-medium">Simplify</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-600 font-medium">Automate</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-amber-600 font-medium">Grow</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-700 font-bold">#VocalForLocal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Strip (Matching Mockup) */}
        <div className="mt-8 sm:mt-10 lg:mt-12 relative">
          <div className="rounded-2xl border border-border/80 bg-surface/90 px-4 py-3 sm:px-6 sm:py-3.5 shadow-lg backdrop-blur-md">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {/* Feature 1 */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-[#FF6E14] text-white shadow-sm shadow-orange-500/20">
                  <Layers className="size-4.5" />
                </div>
                <div>
                  <div className="font-display font-semibold text-sm sm:text-base text-foreground">
                    All-in-One Platform
                  </div>
                  <div className="text-xs text-muted-foreground">Run your entire business</div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-[#138808] text-white shadow-sm shadow-green-600/20">
                  <Zap className="size-4.5" />
                </div>
                <div>
                  <div className="font-display font-semibold text-sm sm:text-base text-foreground">Real-time Sync</div>
                  <div className="text-xs text-muted-foreground">Data always in sync</div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-3">
                <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-[#FF6E14] text-white shadow-sm shadow-orange-500/20">
                  <Users className="size-4.5" />
                </div>
                <div>
                  <div className="font-display font-semibold text-sm sm:text-base text-foreground">Built for India</div>
                  <div className="text-xs text-muted-foreground">GST, compliance & more</div>
                </div>
              </div>

              {/* Feature 4 + Bharat Watermark */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-[#138808] text-white shadow-sm shadow-green-600/20">
                    <ShieldCheck className="size-4.5" />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-sm sm:text-base text-foreground">
                      Your Data, Your Control
                    </div>
                    <div className="text-xs text-muted-foreground">Private & secure</div>
                  </div>
                </div>

                <div className="hidden xl:flex flex-col items-end pl-3 border-l border-border/70">
                  <span className="font-handwriting text-base text-muted-foreground font-bold leading-none select-none">
                    <span className="dark:hidden">From Bharat For Bharat</span>
                    <span className="hidden dark:inline">Bharat First</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


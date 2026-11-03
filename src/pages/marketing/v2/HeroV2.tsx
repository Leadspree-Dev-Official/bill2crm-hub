import { useState } from 'react'
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
  Users2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function HeroV2() {
  const [viewMode, setViewMode] = useState<'3d' | 'studio'>('3d')

  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-border bg-background pb-6 pt-3 sm:pt-4 lg:pt-4"
    >
      {/* View Mode Toggle Pill (Top Right on Hero) */}
      <div className="mx-auto mb-3 flex max-w-7xl justify-end px-4 sm:px-5">
        <div className="inline-flex items-center rounded-lg border border-border/80 bg-surface/80 p-0.5 text-xs shadow-2xs backdrop-blur">
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={cn(
              'rounded-md px-3 py-1 font-medium transition-all',
              viewMode === '3d'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Interactive 3D Stage
          </button>
          <button
            type="button"
            onClick={() => setViewMode('studio')}
            className={cn(
              'rounded-md px-3 py-1 font-medium transition-all',
              viewMode === 'studio'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Studio Render View
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        {/* ========================================================================= */}
        {/* STUDIO RENDER VIEW: Full Continuous High-Definition Mockup Composition    */}
        {/* ========================================================================= */}
        {viewMode === 'studio' ? (
          <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-surface/40 p-3 shadow-2xl backdrop-blur sm:p-5">
            <div className="relative overflow-hidden rounded-2xl">
              {/* Dark Theme Full Studio Image */}
              <img
                src="/images/hero-dark-full.jpg"
                alt="Bill2CRM complete workspace hero in Dark Theme"
                className="hidden dark:block w-full h-auto object-cover rounded-2xl shadow-xl"
              />
              {/* Light Theme Full Studio Image */}
              <img
                src="/images/hero-light-full.jpg"
                alt="Bill2CRM complete workspace hero in Light Theme"
                className="block dark:hidden w-full h-auto object-cover rounded-2xl shadow-xl"
              />

              {/* Interactive Floating Action Bar overlay on the studio render */}
              <div className="absolute bottom-6 left-6 right-6 sm:left-10 sm:right-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/20 bg-black/40 px-6 py-3.5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="flex size-3 rounded-full bg-[#138808] animate-pulse" />
                  <span className="text-xs sm:text-sm font-medium text-white">
                    Experience Bill2CRM: Invoicing • POS • CRM • Inventory • HRMS • Accounting
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    asChild
                    size="sm"
                    className="bg-[#138808] hover:bg-[#16a34a] text-white font-medium rounded-lg px-4 shadow-sm"
                  >
                    <Link to="/signup">
                      Start free trial
                      <ArrowRight className="ml-1.5 size-3.5" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    <Link to="/pricing">Pricing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* INTERACTIVE 3D STAGE: Pure Responsive CSS 3D Model & Real Live Dashboard   */
          /* ========================================================================= */
          <div className="relative">
            {/* Ambient Lighting / Aura */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 left-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-[#FF9933]/15 blur-[120px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-10 top-1/4 -z-10 h-[550px] w-[550px] rounded-full bg-[#138808]/15 blur-[130px]"
            />

            {/* Main 2-Column Hero Area */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-6 xl:gap-10">
              {/* Left Column: Typography & CTAs */}
              <div className="text-left lg:col-span-7 xl:col-span-7">
                {/* Pill Chip */}
                <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/90 px-3 py-1 text-xs font-medium text-foreground dark:text-white shadow-2xs backdrop-blur">
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
                <h1 className="mt-2.5 sm:mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[40px] xl:text-[46px] 2xl:text-[50px] leading-[1.1]">
                  <span className="block text-[#FF6E14] whitespace-normal sm:whitespace-nowrap">6 Apps. 6 Subscriptions.</span>
                  <span className="block text-foreground mt-0.5 sm:mt-1">You Deserve One.</span>
                  <span className="block text-[#138808] dark:text-[#16a34a] mt-0.5 sm:mt-1">Meet Bill2CRM.</span>
                </h1>

                {/* Description */}
                <p className="mt-2.5 sm:mt-3 max-w-xl text-sm sm:text-base leading-normal sm:leading-relaxed text-muted-foreground">
                  Bill2CRM replaces separate invoicing software, POS, CRM, inventory spreadsheets, HR tools and manual
                  bookkeeping — synced in real time, in one private workspace built for Indian businesses.
                </p>

                {/* CTA Action Buttons */}
                <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="h-10.5 sm:h-11 rounded-lg bg-gradient-to-r from-[#FF6E14] to-[#EA580C] px-5 sm:px-6 text-sm sm:text-base font-semibold text-white shadow-md shadow-orange-500/25 hover:opacity-95 active:scale-[0.99] border-0"
                  >
                    <Link to="/signup" className="flex items-center gap-2">
                      Start free trial — no card required
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-10.5 sm:h-11 rounded-lg border-border/80 bg-surface/70 px-4 sm:px-5 text-sm sm:text-base font-semibold text-foreground hover:bg-surface backdrop-blur-xs"
                  >
                    <Link to="/pricing">See pricing</Link>
                  </Button>
                </div>

                {/* Trust Badges */}
                <div className="mt-3.5 sm:mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-foreground dark:text-white">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-sm">🇮🇳</span>
                    <span className="font-medium text-foreground dark:text-white">Made in India</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-[#138808] dark:text-[#16a34a]" />
                    <span className="font-medium text-foreground dark:text-white">GST compliant</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="size-3.5 text-foreground/70 dark:text-white/70" />
                    <span className="font-medium text-foreground dark:text-white">100% data privacy</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-foreground/70 dark:text-white/70" />
                    <span className="font-medium text-foreground dark:text-white">7-day free trial</span>
                  </span>
                </div>

                {/* Handwritten Callout Bottom Left */}
                <div className="mt-2.5 sm:mt-3 flex items-center gap-2">
                  <div className="font-handwriting text-lg sm:text-xl text-foreground/80 tracking-wide -rotate-1">
                    Businesses Build a Stronger Bharat
                    <div className="h-0.5 w-full bg-gradient-to-r from-[#FF9933] via-white/80 to-[#138808] rounded-full mt-0.5 opacity-80" />
                  </div>
                </div>
              </div>

              {/* Right Column: 3D Laptop Stage with Floating App Cubes & Pedestal */}
              <div className="relative lg:col-span-5 xl:col-span-5 pt-4 pb-2">
                {/* Handwritten Callout Top Right */}
                <div className="absolute right-2 top-0 z-20 hidden sm:block">
                  <div className="font-handwriting text-2xl sm:text-3xl text-foreground/85 tracking-wide rotate-2 text-right">
                    All Your Business In Sync
                    <div className="h-0.5 w-full bg-gradient-to-r from-[#FF9933] via-white/80 to-[#138808] rounded-full mt-1 opacity-80" />
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

                {/* 6 Floating 3D Glossy App Tiles (Interactive Icons) */}
                <div className="relative z-20">
                  {/* Tile 1: Invoicing (Top Left) */}
                  <FloatingAppTile
                    icon={FileText}
                    label="Invoicing"
                    tone="orange"
                    className="absolute -top-4 left-4 sm:left-10"
                    delay="0s"
                  />

                  {/* Tile 2: POS (Top Center) */}
                  <FloatingAppTile
                    icon={ShoppingCart}
                    label="POS"
                    tone="coral"
                    className="absolute -top-8 left-1/2 -translate-x-1/2"
                    delay="1s"
                  />

                  {/* Tile 3: CRM (Top Right) */}
                  <FloatingAppTile
                    icon={Users2}
                    label="CRM"
                    tone="green"
                    className="absolute -top-4 right-6 sm:right-16"
                    delay="2s"
                  />

                  {/* Tile 4: Inventory (Mid Right) */}
                  <FloatingAppTile
                    icon={Box}
                    label="Inventory"
                    tone="glass"
                    className="absolute top-28 -right-2 sm:right-2"
                    delay="1.5s"
                  />

                  {/* Tile 5: HRMS (Lower Right) */}
                  <FloatingAppTile
                    icon={Users}
                    label="HRMS"
                    tone="orange"
                    className="absolute bottom-28 -right-3 sm:right-0"
                    delay="2.5s"
                  />

                  {/* Tile 6: Accounting (Bottom Right) */}
                  <FloatingAppTile
                    icon={BarChart3}
                    label="Accounting"
                    tone="green"
                    className="absolute bottom-6 right-4 sm:right-8"
                    delay="0.5s"
                  />
                </div>

                {/* Central Laptop Container */}
                <div className="relative mx-auto max-w-[560px] pt-10 px-4 sm:px-6">
                  {/* Realistic Laptop Chassis */}
                  <div className="relative rounded-t-2xl border-4 border-slate-700/80 bg-slate-900 shadow-2xl ring-1 ring-white/20">
                    {/* Top Webcam Notch */}
                    <div className="flex h-5 items-center justify-center bg-slate-900 px-4">
                      <span className="size-1.5 rounded-full bg-slate-700 ring-1 ring-slate-600" />
                    </div>

                    {/* LAPTOP SCREEN: Live Bill2CRM Dashboard */}
                    <div className="overflow-hidden bg-background text-foreground select-none">
                      {/* Dashboard Header Bar */}
                      <div className="flex items-center justify-between border-b border-border/80 bg-surface px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 font-display font-bold">
                          <img src="/logo.png" alt="Bill2CRM Logo" className="size-5 object-contain" />
                          <span className="text-xs font-semibold">Bill2CRM</span>
                        </div>
                        <div className="hidden items-center gap-1.5 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground sm:flex">
                          <Search className="size-3" />
                          <span>Search...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bell className="size-3.5 text-muted-foreground" />
                          <div className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2 py-0.5">
                            <span className="grid size-4 place-items-center rounded-full bg-[#138808] text-[9px] font-bold text-white">
                              RS
                            </span>
                            <span className="text-[10px] font-medium">Rahul Sharma</span>
                          </div>
                        </div>
                      </div>

                      {/* Dashboard Body */}
                      <div className="flex min-h-[260px]">
                        {/* Left Sidebar */}
                        <div className="w-24 sm:w-28 border-r border-border/70 bg-surface/50 p-2 text-[10px] space-y-1">
                          <div className="flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 font-semibold text-primary">
                            <Layers className="size-3" />
                            <span>Dashboard</span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:text-foreground">
                            <FileText className="size-3" />
                            <span>Invoicing</span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:text-foreground">
                            <ShoppingCart className="size-3" />
                            <span>POS</span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:text-foreground">
                            <Users className="size-3" />
                            <span>CRM</span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:text-foreground">
                            <Box className="size-3" />
                            <span>Inventory</span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:text-foreground">
                            <BarChart3 className="size-3" />
                            <span>Accounting</span>
                          </div>
                        </div>

                        {/* Main Dashboard Canvas */}
                        <div className="flex-1 p-3">
                          {/* 4 Metric KPI Cards */}
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div className="rounded-lg border border-border/80 bg-surface p-2">
                              <div className="text-[9px] text-muted-foreground">Total Sales</div>
                              <div className="font-display font-bold text-xs sm:text-sm text-foreground">
                                ₹ 12,48,230
                              </div>
                              <div className="text-[9px] font-semibold text-[#138808] dark:text-[#16a34a]">↑ 12%</div>
                            </div>

                            <div className="rounded-lg border border-border/80 bg-surface p-2">
                              <div className="text-[9px] text-muted-foreground">Total Invoices</div>
                              <div className="font-display font-bold text-xs sm:text-sm text-foreground">324</div>
                              <div className="text-[9px] font-semibold text-[#138808] dark:text-[#16a34a]">↑ 8%</div>
                            </div>

                            <div className="rounded-lg border border-border/80 bg-surface p-2">
                              <div className="text-[9px] text-muted-foreground">Active Customers</div>
                              <div className="font-display font-bold text-xs sm:text-sm text-foreground">1,245</div>
                              <div className="text-[9px] font-semibold text-[#138808] dark:text-[#16a34a]">↑ 18%</div>
                            </div>

                            <div className="rounded-lg border border-border/80 bg-surface p-2">
                              <div className="text-[9px] text-muted-foreground">Pending Items</div>
                              <div className="font-display font-bold text-xs sm:text-sm text-foreground">12</div>
                              <div className="text-[9px] font-semibold text-rose-500">↓ 4%</div>
                            </div>
                          </div>

                          {/* Chart & Top Products Row */}
                          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {/* Area Wave Chart */}
                            <div className="sm:col-span-2 rounded-lg border border-border/80 bg-surface p-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold">Sales Overview</span>
                                <span className="rounded bg-[#138808]/10 px-1.5 py-0.5 font-bold text-[#138808] dark:text-[#16a34a]">
                                  ₹ 2,48,230
                                </span>
                              </div>
                              <svg viewBox="0 0 260 70" className="mt-1 h-14 w-full" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="chartGradV2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#138808" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#138808" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>
                                <path
                                  d="M 0 55 Q 30 45 60 48 T 120 28 T 180 38 T 260 14 L 260 70 L 0 70 Z"
                                  fill="url(#chartGradV2)"
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
                              <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
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
                            <div className="rounded-lg border border-border/80 bg-surface p-2 text-[10px]">
                              <div className="font-semibold mb-1">Top Products</div>
                              <div className="space-y-1 text-[9px]">
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
                  <div className="relative mx-auto h-4 w-[104%] -left-[2%] rounded-b-xl bg-gradient-to-b from-slate-700 via-slate-600 to-slate-800 shadow-xl border-t border-slate-500">
                    <div className="mx-auto h-1 w-16 rounded-b bg-slate-400/80" />
                  </div>

                  {/* ========================================================================= */}
                  {/* PEDESTAL: Dark Neon Stage vs Light Tricolor 3-Tiered Platform            */}
                  {/* ========================================================================= */}
                  {/* DARK THEME PEDESTAL */}
                  <div className="hidden dark:block mt-2">
                    <div className="relative rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 p-3 shadow-2xl shadow-emerald-950/40">
                      {/* Neon Glowing Edge */}
                      <div className="absolute inset-x-0 -top-0.5 h-0.5 bg-gradient-to-r from-[#FF9933] via-white to-[#138808] opacity-80" />
                      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs font-semibold tracking-wider text-slate-300">
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

                  {/* LIGHT THEME PEDESTAL (3-Tiered Saffron, White, Green stone) */}
                  <div className="block dark:hidden mt-3">
                    <div className="relative rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                      {/* Top Tier: Saffron Stone */}
                      <div className="bg-[#FF9933] h-3.5 w-full border-b border-orange-400/50" />
                      {/* Middle Tier: White Marble */}
                      <div className="bg-[#FAF9F6] px-4 py-2.5 flex items-center justify-between border-b border-slate-200 text-xs">
                        {/* Potted Plant "Viksit Bharat" */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🪴</span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            Viksit Bharat
                          </span>
                        </div>
                        {/* Wooden Desk Plaque "Built for Indian Businesses" */}
                        <div className="flex items-center gap-2 rounded-md bg-amber-100/80 border border-amber-300/80 px-2.5 py-1 font-semibold text-amber-950 shadow-2xs">
                          <span>🇮🇳</span>
                          <span className="text-[11px] tracking-tight">Built for Indian Businesses</span>
                        </div>
                      </div>
                      {/* Base Tier: India Green Stone */}
                      <div className="bg-[#138808] h-3.5 w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Feature Strip (Matching Mockup) */}
            <div className="mt-4 sm:mt-5 lg:mt-6 relative">
              <div className="rounded-2xl border border-border/80 bg-surface/95 px-4 py-2.5 sm:px-6 sm:py-3 shadow-xl backdrop-blur-md">
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
                      <div className="font-display font-semibold text-sm sm:text-base text-foreground">
                        Real-time Sync
                      </div>
                      <div className="text-xs text-muted-foreground">Data always in sync</div>
                    </div>
                  </div>

                  {/* Feature 3 */}
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full bg-[#FF6E14] text-white shadow-sm shadow-orange-500/20">
                      <Users className="size-4.5" />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-sm sm:text-base text-foreground">
                        Built for India
                      </div>
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
        )}
      </div>
    </section>
  )
}

function FloatingAppTile({
  icon: Icon,
  label,
  tone,
  className,
  delay = '0s',
}: {
  icon: typeof FileText
  label: string
  tone: 'orange' | 'coral' | 'green' | 'glass'
  className?: string
  delay?: string
}) {
  const toneStyles = {
    orange:
      'bg-gradient-to-br from-[#FF9933] to-[#FF6E14] text-white shadow-orange-500/30 border-orange-300/40',
    coral:
      'bg-gradient-to-br from-[#FF6E14] to-[#EA580C] text-white shadow-orange-600/30 border-orange-400/40',
    green:
      'bg-gradient-to-br from-[#16A34A] to-[#138808] text-white shadow-green-600/30 border-emerald-300/40',
    glass:
      'bg-gradient-to-br from-slate-200/80 to-slate-400/80 dark:from-slate-700/80 dark:to-slate-800/80 text-foreground shadow-slate-900/20 border-white/40',
  }[tone]

  return (
    <div
      style={{ animationDelay: delay }}
      className={cn(
        'flex flex-col items-center gap-1 animate-[float-y_6s_ease-in-out_infinite] transition-transform duration-300 hover:scale-110 hover:z-30 cursor-pointer',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-11 sm:size-14 items-center justify-center rounded-2xl border-2 p-2 shadow-xl backdrop-blur-md',
          toneStyles,
        )}
      >
        <Icon className="size-6 sm:size-7 drop-shadow-md" />
      </div>
      <span className="rounded-full bg-surface/90 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-foreground shadow-xs border border-border/80 backdrop-blur-xs">
        {label}
      </span>
    </div>
  )
}

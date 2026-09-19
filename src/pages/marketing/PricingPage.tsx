import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  Lock,
  Minus,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ShoppingCart,
  Plus,
  Tag,
  MessageCircle,
  HelpCircle,
  Zap,
  Store,
  Crown,
  Server,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { MarketingNav } from './sections/MarketingNav'
import { MarketingFooter } from './sections/MarketingFooter'

type BillingCycle = 'monthly' | 'yearly' | 'lifetime'

interface PricingTier {
  id: string
  name: string
  tagline: string
  badge?: string
  icon: typeof Store
  highlighted?: boolean
  prices: {
    monthly: number
    yearly: number
    lifetime: number | null
  }
  regularPrices: {
    yearly: number
    lifetime: number | null
  }
  includedSeats: number
  features: string[]
}

const TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter Retail',
    tagline: 'Solo · single-counter retail shops, boutiques, and traders.',
    icon: Store,
    prices: {
      monthly: 49,
      yearly: 499,
      lifetime: null,
    },
    regularPrices: {
      yearly: 1499,
      lifetime: null,
    },
    includedSeats: 1,
    features: [
      '1 Admin / Cashier seat included',
      'Unlimited GST Invoices & Bills of Supply',
      'High-speed Touchscreen POS with Offline mode',
      'Universal ESC/POS Thermal Printing (2" & 3")',
      'Single godown / store inventory management',
      'Dynamic UPI QR code on receipts',
      'Standard email & community support',
    ],
  },
  {
    id: 'growth',
    name: 'Cloud SaaS / Growth',
    tagline: 'Supabase · shared database for multi-staff retail & distributors.',
    badge: 'Most Popular',
    icon: Zap,
    highlighted: true,
    prices: {
      monthly: 149,
      yearly: 1499,
      lifetime: null,
    },
    regularPrices: {
      yearly: 3499,
      lifetime: null,
    },
    includedSeats: 3,
    features: [
      '3 User seats included with role-based permissions',
      'All Starter Retail features included',
      'Multi-warehouse inventory with Batch & Expiry (FEFO)',
      'CRM & WhatsApp PDF invoice auto-dispatch',
      'Customer Udhar (credit ledger) & payment reminders',
      'Staff mobile GPS attendance & commission tracking',
      'Real-time Profit & Loss and Balance Sheet reports',
      'Chartered Accountant (CA) read-only portal access',
    ],
  },
  {
    id: 'enterprise',
    name: 'Private Cloud',
    tagline: 'Your own database · best value for high-volume enterprises.',
    badge: 'Maximum Value',
    icon: Crown,
    prices: {
      monthly: 299,
      yearly: 2999,
      lifetime: 6999,
    },
    regularPrices: {
      yearly: 4999,
      lifetime: 14999,
    },
    includedSeats: 10,
    features: [
      '10 User seats included (scalable to unlimited)',
      'All Growth features included',
      'Dedicated Indian cloud server (VPS) with 99.99% uptime',
      'Custom domain (billing.yourbrand.com) & white-labeling',
      'Custom print bill layout designer & branding',
      'Dedicated Account Manager & 24/7 Priority WhatsApp SLA',
      'Automated nightly cloud backups with SQL dump export',
      'API Webhooks & custom ERP integrations',
    ],
  },
]

interface Addon {
  id: string
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  lifetimePrice: number
}

const ADDONS: Addon[] = [
  {
    id: 'ca_migration',
    name: 'CA Onboarding & Historical Data Migration',
    description: 'Our team will migrate your products, opening stock & parties from Tally/Excel.',
    monthlyPrice: 999,
    yearlyPrice: 999,
    lifetimePrice: 999,
  },
  {
    id: 'custom_domain',
    name: 'Custom Domain & White-label Branding',
    description: 'Host your portal on your own domain (e.g. portal.mybusiness.in) with your logo.',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    lifetimePrice: 4999,
  },
  {
    id: 'priority_support',
    name: '24/7 Dedicated WhatsApp SLA Support',
    description: 'Direct phone & WhatsApp hotline with guaranteed under-15-minute response time.',
    monthlyPrice: 499,
    yearlyPrice: 4990,
    lifetimePrice: 9999,
  },
]

const COMPARISON_DATA = [
  { feature: 'Core GST Invoicing & E-Way Bills', starter: true, growth: true, enterprise: true },
  { feature: 'Offline Touchscreen POS', starter: true, growth: true, enterprise: true },
  { feature: 'Thermal Printer Integration', starter: true, growth: true, enterprise: true },
  { feature: 'Included User Seats', starter: '1 User', growth: '3 Users', enterprise: '10 Users' },
  { feature: 'Multi-Warehouse Godown Tracking', starter: false, growth: true, enterprise: true },
  { feature: 'Batch & Expiry Management (FEFO)', starter: false, growth: true, enterprise: true },
  { feature: 'Customer Udhar & WhatsApp Reminders', starter: false, growth: true, enterprise: true },
  { feature: 'Staff GPS Attendance & Commission', starter: false, growth: true, enterprise: true },
  { feature: 'Automated P&L & Balance Sheet', starter: false, growth: true, enterprise: true },
  { feature: 'CA Read-Only Access Portal', starter: false, growth: true, enterprise: true },
  { feature: 'Dedicated Cloud VPS / Instance', starter: false, growth: false, enterprise: true },
  { feature: 'Custom Domain & White-label', starter: 'Add-on', growth: 'Add-on', enterprise: true },
  { feature: '24/7 Priority WhatsApp Support', starter: 'Standard', growth: 'Priority', enterprise: 'Dedicated VIP' },
]

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly')
  const [selectedTierId, setSelectedTierId] = useState<string>('growth')
  const [extraSeats, setExtraSeats] = useState<number>(0)
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [couponCode, setCouponCode] = useState<string>('')
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [couponApplied, setCouponApplied] = useState<boolean>(false)

  // When switching to Lifetime cycle, auto-select Private Cloud (enterprise) because
  // it's the only tier that supports lifetime billing.
  const handleCycleChange = (newCycle: BillingCycle) => {
    setCycle(newCycle)
    if (newCycle === 'lifetime') {
      setSelectedTierId('enterprise')
    }
  }

  const activeTier = useMemo(() => {
    return TIERS.find((t) => t.id === selectedTierId) || TIERS[1]
  }, [selectedTierId])

  // Seat pricing logic (Launch rates)
  const seatUnitPrice = useMemo(() => {
    if (cycle === 'monthly') return 49
    if (cycle === 'yearly') return 490
    return 999
  }, [cycle])

  // Calculate base price (null when tier has no price for the selected cycle)
  const basePrice = useMemo(() => {
    return activeTier.prices[cycle] ?? 0
  }, [activeTier, cycle])

  // Calculate extra seats price
  const extraSeatsPrice = useMemo(() => {
    return extraSeats * seatUnitPrice
  }, [extraSeats, seatUnitPrice])

  // Calculate addons price
  const addonsPrice = useMemo(() => {
    return selectedAddons.reduce((acc, addonId) => {
      const addon = ADDONS.find((a) => a.id === addonId)
      if (!addon) return acc
      if (cycle === 'monthly') return acc + addon.monthlyPrice
      if (cycle === 'yearly') return acc + addon.yearlyPrice
      return acc + addon.lifetimePrice
    }, 0)
  }, [selectedAddons, cycle])

  // Subtotal
  const subtotal = basePrice + extraSeatsPrice + addonsPrice

  // Discount
  const discountAmount = useMemo(() => {
    if (!couponApplied || discountPercent <= 0) return 0
    return Math.round((subtotal * discountPercent) / 100)
  }, [subtotal, couponApplied, discountPercent])

  const discountedSubtotal = subtotal - discountAmount

  // GST 18% calculation
  const cgst = useMemo(() => Math.round((discountedSubtotal * 0.09)), [discountedSubtotal])
  const sgst = useMemo(() => Math.round((discountedSubtotal * 0.09)), [discountedSubtotal])
  const totalGst = cgst + sgst

  // Grand Total
  const grandTotal = discountedSubtotal + totalGst

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = couponCode.trim().toUpperCase()
    if (cleanCode === 'BHARAT10' || cleanCode === 'SAVE10') {
      setDiscountPercent(10)
      setCouponApplied(true)
      toast.success('Coupon applied! 10% discount added to your cart.')
    } else if (cleanCode === 'LEADSPREE20') {
      setDiscountPercent(20)
      setCouponApplied(true)
      toast.success('Partner Coupon applied! 20% discount added to your cart.')
    } else if (cleanCode === '') {
      toast.error('Please enter a coupon code.')
    } else {
      toast.error('Invalid coupon code. Try code: BHARAT10')
    }
  }

  // Format currency in Indian Lakhs/Thousands format
  const formatInr = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // WhatsApp order link
  const whatsappOrderUrl = useMemo(() => {
    const text = encodeURIComponent(
      `Hello Bill2CRM Team! I am interested in subscribing to:\n` +
        `• Plan: ${activeTier.name} (${cycle.toUpperCase()})\n` +
        `• Additional Seats: ${extraSeats}\n` +
        `• Selected Add-ons: ${selectedAddons.length > 0 ? selectedAddons.join(', ') : 'None'}\n` +
        `• Estimated Total (incl. GST): ${formatInr(grandTotal)}\n` +
        `Please guide me with payment and activation.`
    )
    return `https://wa.me/919876543210?text=${text}`
  }, [activeTier, cycle, extraSeats, selectedAddons, grandTotal])

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/50 via-background to-background pt-8 pb-7 sm:pt-10 sm:pb-8 text-center">
        <div className="mx-auto max-w-5xl px-4 sm:px-5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-0.5 text-xs font-medium text-primary shadow-xs">
            <Sparkles className="size-3.5" />
            <span>Fair, Transparent &amp; Predictable Pricing</span>
          </div>

          <h1 className="mt-2.5 text-2xl font-bold tracking-tight sm:text-4xl text-foreground">
            Simple Pricing That Pays For Itself
          </h1>

          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            Choose your plan, customize your seats and add-ons in real-time, and get full GST compliance with zero hidden surprises.
          </p>

          {/* Launch Price Urgency Announcement Banner */}
          <div className="mx-auto mt-3 max-w-2xl rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-1.5 text-center shadow-2xs">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles className="size-3.5" />
                <span>🚀 Early Bird Launch Pricing:</span>
              </span>
              <span className="text-muted-foreground text-[11px] sm:text-xs">
                Starter @ ₹499/yr · Cloud SaaS @ ₹1,499/yr · Private Cloud @ ₹2,999/yr (Private Cloud Lifetime @ ₹6,999)
              </span>
            </div>
          </div>

          {/* Billing Cycle Switcher */}
          <div className="mt-3.5 sm:mt-4 inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleCycleChange('monthly')}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all',
                cycle === 'monthly'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
              )}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => handleCycleChange('yearly')}
              className={cn(
                'relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5',
                cycle === 'yearly'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
              )}
            >
              <span>Annual Billing</span>
              <span className="rounded-full bg-[#138808] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-tight">
                Save 20%
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCycleChange('lifetime')}
              className={cn(
                'relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5',
                cycle === 'lifetime'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
              )}
            >
              <span>Lifetime License</span>
              <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                Pay Once
              </span>
            </button>
          </div>

          <p className="mt-2 text-[11px] sm:text-xs text-muted-foreground">
            All plans include 7-day full free trial · No credit card required · Instant online activation
          </p>
        </div>
      </section>

      {/* Main Pricing & Interactive Cart Section */}
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-5">
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            
            {/* Left Column: Plan Cards & Add-ons Customizer (8 Cols) */}
            <div className="space-y-10 lg:col-span-8">
              
              {/* Step 1: Select Base Plan */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      1
                    </span>
                    Select Your Business Plan
                  </h2>
                  <span className="text-xs text-muted-foreground">Click to select active plan</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {TIERS.map((tier) => {
                    const isSelected = tier.id === selectedTierId
                    const Icon = tier.icon
                    const price = tier.prices[cycle]
                    const hasLifetime = tier.prices.lifetime != null
                    const isDisabledByLifetime = cycle === 'lifetime' && !hasLifetime

                    return (
                      <div
                        key={tier.id}
                        onClick={() => !isDisabledByLifetime && setSelectedTierId(tier.id)}
                        className={cn(
                          'relative rounded-2xl border p-5 transition-all flex flex-col justify-between',
                          isDisabledByLifetime
                            ? 'cursor-not-allowed border-dashed border-border opacity-50'
                            : 'cursor-pointer',
                          !isDisabledByLifetime && isSelected
                            ? 'border-primary ring-2 ring-primary/20 bg-surface shadow-md'
                            : !isDisabledByLifetime
                              ? 'border-border bg-surface/60 hover:border-border/80 hover:bg-surface'
                              : ''
                        )}
                      >
                        {tier.badge && !isDisabledByLifetime && (
                          <div className="absolute -top-3 right-4">
                            <Badge className="bg-[#138808] hover:bg-[#138808] text-white text-[10px] font-semibold px-2 py-0.5 shadow-2xs">
                              {tier.badge}
                            </Badge>
                          </div>
                        )}

                        {isDisabledByLifetime && (
                          <div className="absolute -top-3 right-4">
                            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                              <Lock className="size-3" />
                              Monthly & Annual only
                            </Badge>
                          </div>
                        )}

                        {cycle === 'lifetime' && hasLifetime && (
                          <div className="absolute -top-3 right-4">
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 text-[10px] font-semibold gap-1 border border-amber-500/30">
                              <Server className="size-3" /> Dedicated Server
                            </Badge>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2.5 mb-2">
                            <div
                              className={cn(
                                'flex size-9 items-center justify-center rounded-xl',
                                isDisabledByLifetime ? 'bg-surface-muted text-muted-foreground/50' : isSelected ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted-foreground'
                              )}
                            >
                              <Icon className="size-4.5" />
                            </div>
                            <h3 className="font-bold text-foreground text-base">{tier.name}</h3>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                            {tier.tagline}
                          </p>

                          <div className="mb-4">
                            {isDisabledByLifetime ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">Shared server plan</span>
                              </div>
                            ) : (
                              <>
                                {/* Strikethrough regular price for launch offer */}
                                {cycle === 'yearly' && (
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="text-xs text-muted-foreground line-through">
                                      {formatInr(tier.regularPrices.yearly)}/yr
                                    </span>
                                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0">
                                      Save {Math.round((1 - tier.prices.yearly / tier.regularPrices.yearly) * 100)}%
                                    </Badge>
                                  </div>
                                )}

                                {cycle === 'lifetime' && tier.regularPrices.lifetime != null && price != null && (
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="text-xs text-muted-foreground line-through">
                                      {formatInr(tier.regularPrices.lifetime)} regular
                                    </span>
                                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0">
                                      Save {formatInr(tier.regularPrices.lifetime - price)}
                                    </Badge>
                                  </div>
                                )}

                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                                    {price != null ? formatInr(price) : '—'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {cycle === 'monthly' ? '/mo' : cycle === 'yearly' ? '/yr' : ' one-time'}
                                  </span>
                                </div>
                                {cycle === 'yearly' && (
                                  <p className="text-[11px] text-[#138808] font-medium mt-0.5">
                                    Equivalent to {formatInr(Math.round(tier.prices.yearly / 12))}/mo
                                  </p>
                                )}
                              </>
                            )}
                          </div>

                          <ul className="space-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                            {tier.features.slice(0, 4).map((f) => (
                              <li key={f} className="flex items-start gap-1.5">
                                <Check className="mt-0.5 size-3.5 text-[#138808] shrink-0" />
                                <span className="line-clamp-1">{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-5 pt-3 border-t border-border/40">
                          <Button
                            size="sm"
                            variant={isDisabledByLifetime ? 'outline' : isSelected ? 'default' : 'outline'}
                            className={cn('w-full text-xs', isDisabledByLifetime && 'opacity-50 cursor-not-allowed')}
                            disabled={isDisabledByLifetime}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isDisabledByLifetime) setSelectedTierId(tier.id)
                            }}
                          >
                            {isDisabledByLifetime ? 'Not available for Lifetime' : isSelected ? 'Selected Plan' : 'Choose Plan'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Step 2: Configure Extra User Seats */}
              <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        2
                      </span>
                      Additional Staff &amp; Cashier Seats
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activeTier.includedSeats} seat{activeTier.includedSeats > 1 ? 's are' : ' is'} included in {activeTier.name}. Need more for cashiers or managers?
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-xl border border-border bg-surface-muted p-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg"
                        onClick={() => setExtraSeats((s) => Math.max(0, s - 1))}
                        disabled={extraSeats === 0}
                      >
                        <Minus className="size-3.5" />
                      </Button>

                      <div className="w-12 text-center font-mono font-bold text-sm text-foreground">
                        {extraSeats}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg"
                        onClick={() => setExtraSeats((s) => s + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>

                    <div className="text-right text-xs">
                      <div className="font-semibold text-foreground">
                        {extraSeats > 0 ? `+${formatInr(extraSeatsPrice)}` : 'No extra seats'}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {formatInr(seatUnitPrice)}/seat {cycle === 'monthly' ? '/mo' : cycle === 'yearly' ? '/yr' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Business Add-Ons */}
              <div>
                <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2 mb-4">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    3
                  </span>
                  Optional Setup &amp; Service Add-ons
                </h2>

                <div className="grid gap-3 sm:grid-cols-3">
                  {ADDONS.map((addon) => {
                    const isChecked = selectedAddons.includes(addon.id)
                    const addonPrice =
                      cycle === 'monthly'
                        ? addon.monthlyPrice
                        : cycle === 'yearly'
                        ? addon.yearlyPrice
                        : addon.lifetimePrice

                    return (
                      <div
                        key={addon.id}
                        onClick={() => toggleAddon(addon.id)}
                        className={cn(
                          'cursor-pointer rounded-xl border p-4 transition-all flex flex-col justify-between',
                          isChecked
                            ? 'border-primary/80 bg-primary-soft/20 shadow-xs ring-1 ring-primary/30'
                            : 'border-border bg-surface hover:bg-surface-muted/60'
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-semibold text-foreground text-xs sm:text-sm">
                              {addon.name}
                            </span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="size-4 rounded text-primary focus:ring-primary accent-primary mt-0.5 cursor-pointer"
                            />
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {addon.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/40 font-mono text-xs font-semibold text-foreground">
                          +{formatInr(addonPrice)}
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {addon.id === 'ca_migration'
                              ? ' (one-time)'
                              : cycle === 'monthly'
                              ? '/mo'
                              : cycle === 'yearly'
                              ? '/yr'
                              : ''}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>

            {/* Right Column: Live Pricing Cart & Order Summary (4 Cols) */}
            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="rounded-2xl border-2 border-primary/40 bg-surface p-5 sm:p-6 shadow-xl ring-1 ring-primary/10">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="size-5 text-primary" />
                    <h3 className="font-bold text-foreground text-base">Your Pricing Cart</h3>
                  </div>
                  <Badge variant="outline" className="text-xs uppercase font-mono border-primary/30 text-primary">
                    {cycle}
                  </Badge>
                </div>

                {/* Cart Line Items */}
                <div className="mt-4 space-y-3 text-xs border-b border-border pb-4">
                  {/* Base Plan Item */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-foreground">{activeTier.name} (Launch Rate)</span>
                      <p className="text-[11px] text-muted-foreground">
                        Includes {activeTier.includedSeats} base seat{activeTier.includedSeats > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="font-mono font-medium text-foreground">
                      {formatInr(basePrice)}
                    </span>
                  </div>

                  {/* Launch Discount Savings Highlight */}
                  {cycle === 'yearly' && (
                    <div className="flex items-center justify-between rounded-lg bg-[#138808]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#138808] border border-[#138808]/20">
                      <span>Early Bird Savings (vs ₹{activeTier.regularPrices.yearly}/yr)</span>
                      <span>-{formatInr(activeTier.regularPrices.yearly - activeTier.prices.yearly)}</span>
                    </div>
                  )}

                  {cycle === 'lifetime' && activeTier.regularPrices.lifetime != null && activeTier.prices.lifetime != null && (
                    <div className="flex items-center justify-between rounded-lg bg-[#138808]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#138808] border border-[#138808]/20">
                      <span>Launch Savings (vs ₹{activeTier.regularPrices.lifetime})</span>
                      <span>-{formatInr(activeTier.regularPrices.lifetime - activeTier.prices.lifetime)}</span>
                    </div>
                  )}

                  {/* Extra Seats Item */}
                  {extraSeats > 0 && (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-foreground">
                          {extraSeats} Additional Seat{extraSeats > 1 ? 's' : ''}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          @{formatInr(seatUnitPrice)} each
                        </p>
                      </div>
                      <span className="font-mono font-medium text-foreground">
                        +{formatInr(extraSeatsPrice)}
                      </span>
                    </div>
                  )}

                  {/* Selected Addons */}
                  {selectedAddons.map((addonId) => {
                    const addon = ADDONS.find((a) => a.id === addonId)
                    if (!addon) return null
                    const p =
                      cycle === 'monthly'
                        ? addon.monthlyPrice
                        : cycle === 'yearly'
                        ? addon.yearlyPrice
                        : addon.lifetimePrice

                    return (
                      <div key={addonId} className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-foreground">{addon.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleAddon(addonId)}
                            className="text-[10px] text-destructive hover:underline block"
                          >
                            Remove
                          </button>
                        </div>
                        <span className="font-mono font-medium text-foreground">
                          +{formatInr(p)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Coupon Code Section */}
                <form onSubmit={handleApplyCoupon} className="mt-4 border-b border-border pb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Promo code (e.g. BHARAT10)"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="pl-8 text-xs uppercase h-8"
                      />
                    </div>
                    <Button type="submit" size="sm" variant="outline" className="h-8 text-xs">
                      Apply
                    </Button>
                  </div>
                  {couponApplied && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#138808] font-medium">
                      <span>Promo discount ({discountPercent}%)</span>
                      <span>-{formatInr(discountAmount)}</span>
                    </div>
                  )}
                </form>

                {/* Subtotal & 18% GST Breakdown */}
                <div className="mt-4 space-y-2 text-xs border-b border-border pb-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Taxable Subtotal</span>
                    <span className="font-mono text-foreground">{formatInr(discountedSubtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>CGST (9%)</span>
                    <span className="font-mono text-foreground">{formatInr(cgst)}</span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>SGST (9%)</span>
                    <span className="font-mono text-foreground">{formatInr(sgst)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>Total GST (18% ITC Available)</span>
                    <span className="font-mono text-foreground">{formatInr(totalGst)}</span>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="mt-4 flex items-baseline justify-between">
                  <div>
                    <div className="font-bold text-base text-foreground">Total Payable</div>
                    <div className="text-[10px] text-muted-foreground">Inclusive of 18% GST</div>
                  </div>
                  <div className="font-display font-bold text-2xl text-[#138808]">
                    {formatInr(grandTotal)}
                  </div>
                </div>

                {/* Action CTAs */}
                <div className="mt-6 space-y-2.5">
                  <Button
                    asChild
                    size="lg"
                    className="w-full bg-[#138808] hover:bg-[#16a34a] text-white font-semibold shadow-md text-sm h-11"
                  >
                    <Link
                      to={`/signup?plan=${activeTier.id}&cycle=${cycle}&seats=${
                        activeTier.includedSeats + extraSeats
                      }`}
                    >
                      Start 7-Day Free Trial
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>

                  <a
                    href={whatsappOrderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface hover:bg-surface-muted py-2.5 text-xs font-semibold text-foreground transition-colors"
                  >
                    <MessageCircle className="size-4 text-[#138808]" />
                    <span>Order via WhatsApp Concierge</span>
                  </a>
                </div>

                {/* Trust Badges in Cart */}
                <div className="mt-5 space-y-1.5 text-[11px] text-muted-foreground border-t border-border/60 pt-3">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-[#138808]" />
                    <span>7-day free trial · Cancel anytime with 1 click</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-[#138808]" />
                    <span>Official Tax Invoice for 100% GST Input Credit</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Side-by-Side Full Feature Comparison Matrix */}
      <section className="border-t border-border bg-surface-muted/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Compare Plan Features
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything is transparent. Choose the plan that fits your current operational scale.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-xs">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/70">
                  <th className="p-4 font-semibold text-muted-foreground">Capability</th>
                  <th className="p-4 font-semibold text-center">Starter Retail</th>
                  <th className="p-4 font-bold text-center bg-primary-soft/30 text-primary">
                    Cloud SaaS / Growth
                  </th>
                  <th className="p-4 font-semibold text-center">Private Cloud</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_DATA.map((row) => (
                  <tr key={row.feature} className="border-b border-border last:border-0 hover:bg-surface-muted/30">
                    <td className="p-4 font-medium text-foreground">{row.feature}</td>
                    
                    {/* Starter */}
                    <td className="p-4 text-center">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? (
                          <Check className="size-4 mx-auto text-[#138808]" />
                        ) : (
                          <Minus className="size-4 mx-auto text-muted-foreground/40" />
                        )
                      ) : (
                        <span className="font-mono text-xs">{row.starter}</span>
                      )}
                    </td>

                    {/* Growth */}
                    <td className="p-4 text-center bg-primary-soft/10 font-medium">
                      {typeof row.growth === 'boolean' ? (
                        row.growth ? (
                          <Check className="size-4 mx-auto text-[#138808]" />
                        ) : (
                          <Minus className="size-4 mx-auto text-muted-foreground/40" />
                        )
                      ) : (
                        <span className="font-mono text-xs font-bold text-primary">{row.growth}</span>
                      )}
                    </td>

                    {/* Enterprise */}
                    <td className="p-4 text-center">
                      {typeof row.enterprise === 'boolean' ? (
                        row.enterprise ? (
                          <Check className="size-4 mx-auto text-[#138808]" />
                        ) : (
                          <Minus className="size-4 mx-auto text-muted-foreground/40" />
                        )
                      ) : (
                        <span className="font-mono text-xs font-semibold">{row.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing FAQs */}
      <section className="py-16 sm:py-20 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-center mb-10">
            Frequently Asked Pricing Questions
          </h2>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="size-4 text-primary" />
                Can I claim GST Input Tax Credit (ITC) on my subscription?
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Yes, absolutely! We issue a GST-compliant tax invoice with your company’s GSTIN immediately upon payment. You can claim the full 18% GST (CGST + SGST or IGST) as input credit on your monthly return.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="size-4 text-primary" />
                What happens after the 7-day free trial ends?
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                You will never be charged automatically without your consent. At the end of the 7 days, you can choose to activate any paid plan or export your complete data in Excel/CSV format with one click.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="size-4 text-primary" />
                How does the Lifetime License work?
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                The lifetime license allows you to pay once and use Bill2CRM perpetually with no recurring software fees. It includes 3 full years of major feature updates, bug fixes, and continuous GST compliance updates.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <HelpCircle className="size-4 text-primary" />
                Can I upgrade or add more cashier seats later?
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Yes. You can add or remove cashier and admin seats anytime from your business dashboard. Extra seat charges are prorated to your active billing cycle automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

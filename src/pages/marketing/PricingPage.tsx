import { MarketingNav } from './sections/MarketingNav'
import { MarketingFooter } from './sections/MarketingFooter'
import { Pricing } from './sections/Pricing'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <MarketingNav />
      <Pricing />
      <MarketingFooter />
    </div>
  )
}

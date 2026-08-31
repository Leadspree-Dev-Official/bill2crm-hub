import { MarketingNav } from './sections/MarketingNav'
import { Hero } from './sections/Hero'
import { MetricsBar } from './sections/MetricsBar'
import { WhyChoose } from './sections/WhyChoose'
import { ProblemSolution } from './sections/ProblemSolution'
import { FeaturePillars } from './sections/FeaturePillars'
import { IndustrySolutions } from './sections/IndustrySolutions'
import { DataOwnership } from './sections/DataOwnership'
import { Pricing } from './sections/Pricing'
import { Integrations } from './sections/Integrations'
import { Faq } from './sections/Faq'
import { FinalCta } from './sections/FinalCta'
import { MarketingFooter } from './sections/MarketingFooter'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <MarketingNav />
      <Hero />
      <MetricsBar />
      <WhyChoose />
      <ProblemSolution />
      <FeaturePillars />
      <IndustrySolutions />
      <DataOwnership />
      <Pricing />
      <Integrations />
      <Faq />
      <FinalCta />
      <MarketingFooter />
    </div>
  )
}

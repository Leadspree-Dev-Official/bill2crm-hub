import { MarketingNav } from '../sections/MarketingNav'
import { HeroV2 } from './HeroV2'
import { MetricsBar } from '../sections/MetricsBar'
import { WhyChoose } from '../sections/WhyChoose'
import { ProblemSolution } from '../sections/ProblemSolution'
import { FeaturePillars } from '../sections/FeaturePillars'
import { IndustrySolutions } from '../sections/IndustrySolutions'
import { DataOwnership } from '../sections/DataOwnership'
import { Pricing } from '../sections/Pricing'
import { Integrations } from '../sections/Integrations'
import { Faq } from '../sections/Faq'
import { FinalCta } from '../sections/FinalCta'
import { MarketingFooter } from '../sections/MarketingFooter'

export default function LandingPageV2() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <MarketingNav />
      <HeroV2 />
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

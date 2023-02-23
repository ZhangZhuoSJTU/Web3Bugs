import { observer } from 'mobx-react-lite'
import { NextPage } from 'next'
import { Hero } from '../components/hero/Hero'
import { Layout } from '../components/layout'
import CommunitySection from '../components/layout/CommunitySection'
import { DemocratisingSection } from '../components/layout/DemocratisingSection'
import { FeaturesSection } from '../components/layout/FeaturesSection'
import { PPOSection } from '../components/layout/PPOSection'
import { RoadmapSection } from '../components/layout/RoadmapSection'
import SEO from '../components/SEO'
import { useRootStore } from '../context/RootStoreProvider'
import { InvestorsSection } from '../components/layout/InvestorsSection'

const Index: NextPage = () => {
  const {
    uiStore: { isMobileMenuOpen, toggleMobileMenu },
  } = useRootStore()
  return (
    <Layout isMobileMenuOpen={isMobileMenuOpen} toggleMobileMenu={toggleMobileMenu}>
      <SEO />
      <Hero />
      <FeaturesSection>
        <DemocratisingSection />
        <PPOSection />
        <InvestorsSection />
        <RoadmapSection />
        <CommunitySection />
      </FeaturesSection>
    </Layout>
  )
}

export default observer(Index)

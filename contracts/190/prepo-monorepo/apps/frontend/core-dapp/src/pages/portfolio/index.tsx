import { NextPage } from 'next'
import SEO from '../../components/SEO'
import PortfolioFeature from '../../features/portfolio/Portfolio'

const Portfolio: NextPage = () => (
  <>
    <SEO
      title="Portfolio | prePO"
      description="Explore your portfolio on prePO"
      ogImageUrl="/prepo-og-image.png"
    />
    <PortfolioFeature />
  </>
)

export default Portfolio

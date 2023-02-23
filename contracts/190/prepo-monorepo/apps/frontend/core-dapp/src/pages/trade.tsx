import TradePage from '../features/trade/TradePage'
import SEO from '../components/SEO'

const TradeMarketPage: React.FC = () => (
  <>
    <SEO
      title="Trade | prePO"
      description="Trade pre-IPO stocks & pre-IDO tokens on prePO"
      ogImageUrl="/prepo-og-image.png"
    />
    <TradePage />
  </>
)

export default TradeMarketPage

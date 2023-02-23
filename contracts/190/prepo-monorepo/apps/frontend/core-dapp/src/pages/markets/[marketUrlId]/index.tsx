import { GetStaticPaths, GetStaticProps } from 'next'
import MarketOverview from '../../../features/market-overview/MarketOverview'
import SEO from '../../../components/SEO'
import { getValuationRangeString } from '../../../features/market-overview/market-utils'
import { markets, marketsMap } from '../../../lib/markets'
import { Market, SupportedMarketID } from '../../../types/market.types'

type Props = {
  selectedMarket: Market
}

const Overview: React.FC<Props> = ({ selectedMarket }) => (
  <>
    <SEO
      title={`${selectedMarket.name} | prePO`}
      description={`${selectedMarket.name} with valuation range: ${getValuationRangeString(
        selectedMarket.static.valuationRange
      )}`}
      ogImageUrl="/prepo-og-image.png"
    />
    <MarketOverview />
  </>
)

export const getStaticPaths: GetStaticPaths = ({ locales = [] }) => {
  // Get the paths we want to pre-render based on posts
  const paths = locales
    .map((locale) =>
      markets.map((market) => ({
        params: { marketUrlId: market.urlId },
        locale,
      }))
    )
    .flat()

  return { paths, fallback: false }
}

export const getStaticProps: GetStaticProps<Partial<Props>, { marketUrlId: string }> = (props) => {
  // this should never happens
  const { params } = props
  if (!params) return { props: {} }
  // Fetch single market
  const selectedMarket = marketsMap[params.marketUrlId.toLowerCase() as SupportedMarketID]
  return { props: { selectedMarket } }
}

export default Overview

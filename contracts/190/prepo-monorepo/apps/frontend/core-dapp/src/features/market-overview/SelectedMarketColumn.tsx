import styled, { css } from 'styled-components'
import { media, spacingIncrement } from 'prepo-ui'
import { Trans } from '@lingui/macro'
import Link from '../../components/Link'
import MarketIconTitle from '../../components/MarketIconTitle'
import { Market } from '../../types/market.types'
import { markets } from '../../lib/markets'

const selectedMarketStyle = css`
  background: ${({ theme }): string => theme.color.searchInputBackground};
  position: relative;

  :before {
    background: ${({ theme }): string => theme.color.primary};
    content: '';
    height: 100%;
    left: 0;
    position: absolute;
    top: 0;
    width: 4px;
  }
`

const Wrapper = styled.div``

const Section = styled.div`
  margin-bottom: ${spacingIncrement(48)};
`

const Title = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: 20px;
  margin: 0;
`

const SelectedMarket = styled.div`
  ${selectedMarketStyle};
  background: transparent;
  padding-left: ${spacingIncrement(9)};
  ${media.desktop`
      margin-top: ${spacingIncrement(17)};
  `}
  > div {
    padding-left: ${spacingIncrement(7)};
  }
`

const MarketItem = styled.div`
  position: relative;
  transition: all 0.3s ease;
  &:hover {
    ${selectedMarketStyle};
  }
`

const MarketIconName = styled(MarketIconTitle)`
  padding: ${spacingIncrement(12)};
  padding-left: ${spacingIncrement(16)};
`

const MarketIconNameFromGroup = styled(MarketIconName)`
  transition: transform 0.3s ease;
  &:hover {
    transform: translateX(5px);
  }
`

const MarketGroup = styled.div`
  margin-top: ${spacingIncrement(15)};
`

type Props = Pick<Market, 'iconName' | 'name'>

const SelectedMarketColumn: React.FC<Props> = ({ iconName, name }) => {
  const trendingMarkets = [...markets].filter((market) => market.name !== name)

  return (
    <Wrapper>
      <Section>
        <Title>
          <Trans>Selected Market</Trans>
        </Title>
        <SelectedMarket>
          <MarketIconName iconName={iconName} size="sm">
            {name}
          </MarketIconName>
        </SelectedMarket>
      </Section>
      <Section>
        <Title>
          <Trans>Trending Markets</Trans>
        </Title>
        <MarketGroup>
          {trendingMarkets.map((market) => (
            <Link key={market.urlId} href={`/markets/${market.urlId}`} scroll={false}>
              <MarketItem>
                <MarketIconNameFromGroup iconName={market.iconName} size="sm" color="neutral1">
                  {market.name}
                </MarketIconNameFromGroup>
              </MarketItem>
            </Link>
          ))}
        </MarketGroup>
      </Section>
    </Wrapper>
  )
}

export default SelectedMarketColumn

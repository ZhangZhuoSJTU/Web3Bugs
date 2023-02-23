import { useState } from 'react'
import { Row, Col } from 'antd'
import styled from 'styled-components'
import { centered, spacingIncrement, media, Icon } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import Skeleton from 'react-loading-skeleton'
import { Trans } from '@lingui/macro'
import Link from './Link'
import MarketIconTitle from './MarketIconTitle'
import { MarketEntity } from '../stores/entities/MarketEntity'
import { noSelect } from '../styles/noSelect.style'
import { numberFormatter } from '../utils/numberFormatter'

const { significantDigits } = numberFormatter

type Props = {
  id: string
  market: MarketEntity
}

const Wrapper = styled.div`
  &&& {
    ${noSelect};
    background-color: ${({ theme }): string => theme.color.neutral9};
    border: 1px solid ${({ theme }): string => theme.color.exploreCardBorder};
    border-radius: 1.16px;
    cursor: pointer;
    padding: ${spacingIncrement(20)};
  }
`

const Subtitle = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  line-height: ${spacingIncrement(16)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.lg};
    margin-bottom: ${spacingIncrement(5)};
  `}
`

const InfoCol = styled(Col)`
  display: flex;
  flex-direction: column;
  margin-top: ${spacingIncrement(16)};
  ${media.desktop`
    margin-top: ${spacingIncrement(31)};
  `}
`

const PrimaryText = styled.div`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(20)};
  margin-top: ${spacingIncrement(8)};
  ${media.desktop`
    line-height: ${spacingIncrement(30)};
    font-size: ${({ theme }): string => theme.fontSize.xl};
  `}
`

const Cta = styled(Row)`
  color: ${({ theme }): string => theme.color.primaryLight};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: ${spacingIncrement(16)};
  margin-top: ${spacingIncrement(12)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.lg};
    margin-top: ${spacingIncrement(32)};
  `}
`

const ArrowWrapper = styled.div<{ mouseOver: boolean }>`
  ${centered};
  margin-left: ${({ mouseOver }): string =>
    mouseOver ? spacingIncrement(6) : spacingIncrement(2)};
  transition: margin-left 0.15s ease-in-out;
`

const IconWrapper = styled(Icon)`
  ${centered}
  svg {
    height: ${spacingIncrement(18)};
    width: ${spacingIncrement(18)};
    ${media.desktop`
      height: ${spacingIncrement(27)};
      width: ${spacingIncrement(27)};
    `}
  }
`

const MarketCard: React.FC<Props> = ({ id, market }) => {
  const [mouseOver, setMouseOver] = useState(false)

  return (
    <Link href={`/markets/${market.urlId}`}>
      <Wrapper
        onMouseEnter={(): void => setMouseOver(true)}
        onMouseLeave={(): void => setMouseOver(false)}
      >
        <Row align="top">
          <MarketIconTitle id={id} iconName={market.iconName} size="md">
            {market.name}
          </MarketIconTitle>
        </Row>
        <Row>
          <InfoCol xs={12} md={12}>
            <Subtitle>
              <Trans>Estimated Valuation</Trans>
            </Subtitle>
            {market.estimatedValuation === undefined ? (
              <Skeleton height={30} width={160} />
            ) : (
              <PrimaryText>${significantDigits(market.estimatedValuation.value)}</PrimaryText>
            )}
          </InfoCol>
          <InfoCol xs={12} md={12}>
            <Subtitle>
              <Trans>Valuation Range</Trans>
            </Subtitle>
            {market.valuationRange === undefined ? (
              <Skeleton height={30} width={160} />
            ) : (
              <PrimaryText>
                ${significantDigits(market.valuationRange[0])} - $
                {significantDigits(market.valuationRange[1])}
              </PrimaryText>
            )}
          </InfoCol>
        </Row>
        <Row>
          <InfoCol xs={12} md={12}>
            <Subtitle>
              <Trans>Volume</Trans>
            </Subtitle>
            {market.tradingVolume !== undefined ? (
              <PrimaryText>${significantDigits(market.tradingVolume.value)}</PrimaryText>
            ) : (
              <Skeleton height={30} width={160} />
            )}
          </InfoCol>
          <InfoCol xs={12} md={12}>
            <Subtitle>
              <Trans>Liquidity</Trans>
            </Subtitle>
            {market.liquidity === undefined ? (
              <Skeleton height={30} width={160} />
            ) : (
              <PrimaryText>${significantDigits(market.liquidity.value)}</PrimaryText>
            )}
          </InfoCol>
        </Row>
        <Cta align="middle">
          <div>
            <Trans>Invest in</Trans>&nbsp;
            {market.name}
          </div>
          <ArrowWrapper mouseOver={mouseOver}>
            <IconWrapper name="arrow-right" color="primary" />
          </ArrowWrapper>
        </Cta>
      </Wrapper>
    </Link>
  )
}

export default observer(MarketCard)

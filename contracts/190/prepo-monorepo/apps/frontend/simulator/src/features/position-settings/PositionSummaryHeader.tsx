import React, { useMemo } from 'react'
import styled from 'styled-components'
import { getHoldingPeriodLabel } from './utils/market-position-utils'
import { useAppSelector } from '../../app/hooks'
import { Direction } from '../position/position-slice'
import { media } from '../../utils/media'
import { cardPadding } from '../../components/Card'

const Wrapper = styled.div`
  display: flex;
  ${cardPadding};

  ${media.lg`
    display: block;
  `}
`

const TraderDirectionText = styled.span<{ direction: Direction | null }>`
  color: ${({ direction, theme }): string =>
    direction === 'long' ? theme.colors.profit : theme.colors.loss};
  font-weight: bold;
`

const PrimaryText = styled.span`
  color: ${({ theme }): string => theme.colors.primary};
  font-weight: bold;
`

const PositionSummaryHeader: React.FC = () => {
  const position = useAppSelector((state) => state.position)
  const holdingPeriod = useAppSelector((state) => state.position.holdingPeriod)
  const lpMarketName = position.market ? position.market.name : '...'

  const AdvancedHeader = useMemo(() => {
    const component = (): JSX.Element | null => {
      if (position.ui.mode !== 'advanced') return null
      return (
        <span>
          &nbsp;for&nbsp;
          <PrimaryText>
            {holdingPeriod.num} {getHoldingPeriodLabel(holdingPeriod.unit, holdingPeriod.num)}
          </PrimaryText>
        </span>
      )
    }
    return component
  }, [holdingPeriod.num, holdingPeriod.unit, position.ui.mode])

  const TraderHeader = useMemo(() => {
    const component = (): JSX.Element => (
      <Wrapper>
        <span>
          Going&nbsp;
          <TraderDirectionText direction={position.direction}>
            {position.direction}
          </TraderDirectionText>
          &nbsp;
          <span>as a</span>&nbsp;
          <PrimaryText>{position.type}</PrimaryText>
          <AdvancedHeader />
        </span>
      </Wrapper>
    )
    return component
  }, [AdvancedHeader, position.direction, position.type])

  const LPHeader = useMemo(() => {
    const component = (): JSX.Element => (
      <Wrapper>
        Providing liquidity for&nbsp;<PrimaryText>{lpMarketName}</PrimaryText>
        {position.market && <AdvancedHeader />}
      </Wrapper>
    )
    return component
  }, [AdvancedHeader, lpMarketName, position.market])

  return position.type === 'trader' ? <TraderHeader /> : <LPHeader />
}

export default PositionSummaryHeader

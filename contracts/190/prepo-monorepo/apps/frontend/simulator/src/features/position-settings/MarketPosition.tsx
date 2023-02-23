import React, { createRef, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import { getMarketValuationRange } from './utils/market-position-utils'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import RadioGroup from '../../components/RadioGroup'
import { actions } from '../position/position-slice'
import StyledRadio from '../../components/StyledRadio'
import useBreakpoint from '../../hooks/useBreakpoint'
import markets from '../position/markets'
import Radio from '../../components/Radio'

const MarketLogo = styled.img`
  height: 1.5625rem;
  max-width: 6.5rem;
  object-fit: contain;
`

const MarketLogoWrapper = styled.div`
  align-items: flex-start;
  display: flex;
`

const MarketValuationRangeText = styled.span`
  color: ${({ theme }): string => theme.colors.subtitle};
  font-size: 0.8rem;
  font-weight: normal;
`

const MarketValuationRange = styled.span`
  font-weight: normal;
`

const HorizontalScrollContainer = styled(RadioGroup)<{ smoothScroll: boolean }>`
  display: flex;
  overflow-x: ${({ disabled }): string => (disabled ? 'hidden' : 'scroll')};
  scroll-behavior: ${({ smoothScroll }): string => (smoothScroll ? 'smooth' : 'none')};
  user-select: none;
`

const MarketPosition: React.FC = () => {
  const marketsListRef = createRef<HTMLDivElement>()
  const position = useAppSelector((state) => state.position)
  const dispatch = useAppDispatch()
  const size = useBreakpoint()

  const label =
    position.type === 'trader' ? 'I want to trade...' : 'I want to provide liquidity for...'

  const positionOrLPSelected = position.direction || position.type === 'lp'

  const filteredMarkets = useMemo(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    () => [...markets].filter(([, market]) => market.type === position.ui.marketType),
    [position.ui.marketType]
  )

  useEffect(() => {
    const shouldResetScrollOnMarkets = marketsListRef.current && !position.market?.name
    if (shouldResetScrollOnMarkets) {
      marketsListRef.current.scrollLeft = 0
    }
  }, [marketsListRef, position.market?.name])

  if (position.ui.mode === 'advanced') return null

  const selectedPosition = !positionOrLPSelected ? null : position.ui.marketType

  return (
    <RadioGroup
      label={label}
      onChange={(e): void => {
        dispatch(actions.marketTypeChanged(e.target.value))
        dispatch(actions.setScrollToMarket(true))
        if (size === 'lg') dispatch(actions.positionSettingsCompleted())
      }}
      value={selectedPosition}
      disabled={!positionOrLPSelected}
      childRadioGroup={
        <HorizontalScrollContainer
          ref={marketsListRef}
          smoothScroll={!position.market?.name}
          onChange={(e): void => {
            dispatch(actions.marketChanged(e.target.value))
            dispatch(actions.setScrollToMarket(true))
            if (size === 'lg') dispatch(actions.positionSettingsCompleted())
          }}
          value={position.market?.name}
          noBorder
          disabled={!positionOrLPSelected}
        >
          {filteredMarkets.map(([, market]) => (
            <StyledRadio
              variant="card"
              key={market.name}
              value={market.name}
              checked={position.market?.name === market.name}
              disabled={!positionOrLPSelected}
            >
              <MarketLogoWrapper>
                <MarketLogo src={market.logo.src} />
              </MarketLogoWrapper>
              <MarketValuationRangeText>Valuation Range</MarketValuationRangeText>
              <br />
              <MarketValuationRange>
                {getMarketValuationRange(market.bounds.valuation)}
              </MarketValuationRange>
            </StyledRadio>
          ))}
        </HorizontalScrollContainer>
      }
    >
      <Radio value="preipo">Pre-IPO</Radio>
      <Radio value="pretoken">Pre-Token</Radio>
    </RadioGroup>
  )
}

export default MarketPosition

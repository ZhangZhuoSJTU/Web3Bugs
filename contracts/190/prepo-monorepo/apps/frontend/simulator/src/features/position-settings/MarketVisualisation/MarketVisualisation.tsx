import React, { forwardRef, useEffect } from 'react'
import styled from 'styled-components'
import { OVERFLOW_MARGIN } from './market-visualisation-constants'
import { draw } from './market-visualisation-utils'
import { useAppSelector } from '../../../app/hooks'
import { selectNonZeroOutcome } from '../../position/outcome-selector'
import { spacingIncrement } from '../../app/themes'
import { checkValuationRangeValid, valuationToLongPrice } from '../../../helpers'

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: ${spacingIncrement(2)};
`

const Break = styled.div`
  background-color: ${({ theme }): string => theme.colors.buttonLight} !important;
  height: 1px;
  margin: ${spacingIncrement(1 + OVERFLOW_MARGIN / 16)} 0 ${spacingIncrement(1)} 0;
  width: 100%;
`

// Prevent text clipping on moble
const Canvas = styled.canvas`
  margin-bottom: -${OVERFLOW_MARGIN}px;
  margin-right: -${OVERFLOW_MARGIN}px;
`

const MarketVisualisation: React.FC<{ ref: React.Ref<HTMLCanvasElement> }> = forwardRef(
  (props, ref: React.Ref<HTMLCanvasElement>) => {
    const mode = useAppSelector((state) => state.position.ui.mode)
    const position = useAppSelector((state) => state.position)
    const nonZeroOutcome = useAppSelector(selectNonZeroOutcome)

    const { payoutRange, entry: entryValuation, exit: exitValuation } = position
    const valuationRange = position.market?.bounds.valuation
    const positionInProfit = nonZeroOutcome.profit.marketPosition.amount > 0

    useEffect(() => {
      const refObjectExists = typeof ref === 'object' && ref && ref.current
      if (refObjectExists && valuationRange && mode === 'advanced') {
        const entryPercent = valuationToLongPrice(valuationRange, payoutRange, entryValuation)
        const exitPercent = valuationToLongPrice(valuationRange, payoutRange, exitValuation)
        draw(
          ref.current,
          entryValuation,
          exitValuation,
          entryPercent,
          exitPercent,
          payoutRange,
          valuationRange,
          positionInProfit,
          checkValuationRangeValid(valuationRange)
        )
      }
    }, [entryValuation, exitValuation, payoutRange, valuationRange, positionInProfit, mode, ref])

    if (mode !== 'advanced' || !position.market) return null

    return (
      <Wrapper>
        <Canvas ref={ref} />
        <Break />
      </Wrapper>
    )
  }
)

MarketVisualisation.displayName = 'MarketVisualisation'

export default MarketVisualisation

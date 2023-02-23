import React from 'react'
import styled from 'styled-components'
import { useSelector } from 'react-redux'
import { floatToPercentage, formatTwoDigits } from './utils/market-position-utils'
import { selectScenarioBounds } from '../position/scenario-bounds-selector'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { actions } from '../position/position-slice'
import { spacingIncrement } from '../app/themes'
import { calcMaxCapitalEfficiency } from '../position/max-capital-efficiency-selector'
import InfoTooltipIcon from '../icons/InfoTooltipIcon'
import { checkValuationRangeValid } from '../../helpers'
import Slider, { SliderValue } from '../../components/Slider/Slider'

const Wrapper = styled.div`
  margin-top: ${spacingIncrement(4)};
`

const Title = styled.div`
  font-weight: 800;
  margin-bottom: ${spacingIncrement(3)};
`

const sliderNumberFormatter = (numberValue: number): string => {
  const newValue = formatTwoDigits(numberValue)
  return `${floatToPercentage(parseFloat(newValue))}%`
}

const checkCapitalEfficiency = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispatch: any,
  capitalEfficiency: number,
  floor: number,
  ceil: number
): void => {
  const newMaxCapitalEfficiency = calcMaxCapitalEfficiency({ floor, ceil })
  if (capitalEfficiency > newMaxCapitalEfficiency) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    dispatch(actions.capitalEfficiencyChanged(newMaxCapitalEfficiency))
  }
}

const MarketPayoutRange: React.FC = () => {
  const position = useAppSelector((state) => state.position)
  const scenarioBounds = useSelector(selectScenarioBounds)
  const dispatch = useAppDispatch()

  const MIN_VALUE = 0.05
  const MAX_VALUE = 0.95

  if (
    position.ui.mode !== 'advanced' ||
    !position.market ||
    !scenarioBounds ||
    !checkValuationRangeValid(position.market.bounds.valuation)
  ) {
    return null
  }

  const payoutRangeChanged = (value: SliderValue): void => {
    if (!Array.isArray(value)) {
      // eslint-disable-next-line no-console
      console.error('You need to send 2 values to the PayoutSlider')
      return
    }
    const [floor, ceil] = value as readonly [number, number]
    checkCapitalEfficiency(dispatch, position.capitalEfficiency, floor, ceil)
    dispatch(actions.payoutRangeChanged([floor, ceil]))
  }

  return (
    <Wrapper>
      <Title>
        Payout Range{' '}
        <InfoTooltipIcon text="Long and short positions are paid out within a fixed floor-to-ceiling range. A tighter payout range reduces the max profit/loss for traders, but benefits LPs by limiting their max loss. Docs coming soon." />
      </Title>
      <Slider
        trackColor="neutral"
        min={MIN_VALUE}
        max={MAX_VALUE}
        value={[position.payoutRange.floor, position.payoutRange.ceil]}
        onChange={payoutRangeChanged}
        labelPosition="side"
        step={0.01}
        minDistance={0.01}
        numberFormatter={sliderNumberFormatter}
        tooltipLabels={['Floor', 'Ceiling']}
      />
    </Wrapper>
  )
}

export default MarketPayoutRange

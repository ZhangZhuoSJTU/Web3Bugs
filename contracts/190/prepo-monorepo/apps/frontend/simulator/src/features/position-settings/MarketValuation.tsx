import React from 'react'
import styled from 'styled-components'
import { getPositionColor } from './utils/market-position-utils'
import { selectScenarioBounds } from '../position/scenario-bounds-selector'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { actions } from '../position/position-slice'
import { MultiSelect, MultiSelectItem } from '../../components/MultiSelect'
import { spacingIncrement } from '../app/themes'
import { selectNonZeroOutcome } from '../position/outcome-selector'
import { media } from '../../utils/media'
import {
  calcValuationPrecision,
  checkValuationRangeValid,
  formatValuationNumber,
} from '../../helpers'
import Slider, { SliderValue } from '../../components/Slider/Slider'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`

const ScenariosWrapper = styled.div`
  align-items: center;
  color: ${({ theme }): string => theme.colors.subtitle};
  display: flex;
  font-weight: normal;
  justify-content: center;
  margin-top: ${spacingIncrement(2)};
  width: 100%;
`

const ScenariosContainer = styled(MultiSelect)`
  border: 0;
  display: inline-flex;
  font-size: ${({ theme }): string => theme.fontSize.base};
  margin: auto;
  margin-right: auto;
  max-width: 75%;
  width: 100%;

  ${media.md`
    max-width: 100%;
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
`

const MarketValuation: React.FC = () => {
  const position = useAppSelector((state) => state.position)
  const scenarioBounds = useAppSelector(selectScenarioBounds)
  const dispatch = useAppDispatch()
  const nonZeroOutcome = useAppSelector(selectNonZeroOutcome)

  if (
    !position.market ||
    !scenarioBounds ||
    !checkValuationRangeValid(position.market.bounds.valuation)
  ) {
    return null
  }

  const trackColor = getPositionColor(nonZeroOutcome)

  let selectedScenario = 'Custom'
  if (
    position.entry === scenarioBounds?.maxProfit[0] &&
    position.exit === scenarioBounds?.maxProfit[1]
  )
    selectedScenario = 'Max profit'
  if (position.entry === scenarioBounds?.maxLoss[0] && position.exit === scenarioBounds.maxLoss[1])
    selectedScenario = 'Max loss'

  const onChangeSlider = (value: SliderValue): void => {
    if (!Array.isArray(value)) {
      // eslint-disable-next-line no-console
      console.error('You need to send 2 values to the MarketValuationSlider')
      return
    }
    const [entry, exit] = value as readonly [number, number]
    dispatch(actions.entryAndExitChanged([entry, exit]))
  }

  // eslint-disable-next-line react/no-unstable-nested-components
  const Scenarios = (): JSX.Element => (
    <ScenariosWrapper>
      <ScenariosContainer selectedKey={selectedScenario}>
        <MultiSelectItem
          borderConfig="always"
          itemKey="Max loss"
          onClick={(): void => {
            dispatch(actions.entryAndExitChanged(scenarioBounds.maxLoss))
          }}
        >
          Max Loss
        </MultiSelectItem>
        <MultiSelectItem itemKey="Custom" borderConfig="none">
          Custom
        </MultiSelectItem>
        <MultiSelectItem
          borderConfig="always"
          itemKey="Max profit"
          onClick={(): void => {
            dispatch(actions.entryAndExitChanged(scenarioBounds.maxProfit))
          }}
        >
          Max Profit
        </MultiSelectItem>
      </ScenariosContainer>
    </ScenariosWrapper>
  )

  return (
    <Wrapper>
      <div>
        <Slider
          trackColor={trackColor}
          min={position.market.bounds.valuation.floor}
          max={position.market.bounds.valuation.ceil}
          value={[position.entry, position.exit]}
          onChange={onChangeSlider}
          labelPosition="side"
          step={calcValuationPrecision(
            position.market.bounds.valuation.floor,
            position.market.bounds.valuation.ceil
          )}
          minDistance={-99999} // allow handles to pass each other
          numberFormatter={formatValuationNumber}
          tooltipLabels={['Entry', 'Exit']}
        />
      </div>

      <Scenarios />
    </Wrapper>
  )
}

export default MarketValuation

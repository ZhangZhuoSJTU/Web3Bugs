import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { spacingIncrement, Alert, Slider, SliderValue } from 'prepo-ui'
import { Direction } from './TradeStore'
import Subtitle from '../../components/Subtitle'
import { useRootStore } from '../../context/RootStoreProvider'
import { EstimateYourProfitLoss } from '../definitions'
import { ExitProfitLoss, SliderSettings } from '../../types/market.types'
import Percent from '../../components/Percent'
import { makeAddStep } from '../../utils/number-utils'
import { TWO_DECIMAL_DENOMINATOR, VALUATION_DENOMINATOR } from '../../lib/constants'
import { numberFormatter } from '../../utils/numberFormatter'

const { toUsd, significantDigits } = numberFormatter

type Props = {
  sliderSettings: SliderSettings
  getProfitLossOnExit: (
    direction: Direction,
    exitValuation: number,
    initialInvestment: number
  ) => ExitProfitLoss | undefined
  openTradeAmount: string
}

const Wrapper = styled.div`
  border: 1px solid ${({ theme }): string => theme.color.neutral7};
  margin-bottom: ${spacingIncrement(32)};
  margin-top: ${spacingIncrement(15)};
  padding: ${spacingIncrement(10)};
`

const SliderWrapper = styled.div`
  padding: ${spacingIncrement(80)} 0;
  .ant-tooltip-content {
    width: ${spacingIncrement(60)};
  }
  .ant-tooltip-arrow-content::before {
    background: inherit;
  }
`

const StyledSubtitle = styled(Subtitle)`
  p {
    color: ${({ theme }): string => theme.color.neutral1};
  }
`

const Message = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
`

const ProfitLossPercent = styled(Percent)`
  display: inline-block;
  margin-left: ${spacingIncrement(2)};
`

const AlertWrapper = styled.div`
  &&&& {
    .ant-alert {
      padding: 0.9rem; // Avoids the alert to flicker when profit/loss text changes
    }
  }
`

const getStepWithTwoDecimals = (value: number): number =>
  makeAddStep(value) / TWO_DECIMAL_DENOMINATOR

const sliderNumFormatter = (value: number): string =>
  `$${significantDigits(value * VALUATION_DENOMINATOR)}`

const EstimateProfitLoss: React.FC<Props> = ({
  getProfitLossOnExit,
  sliderSettings,
  openTradeAmount,
}) => {
  const { tradeStore } = useRootStore()
  const { direction } = tradeStore

  const [lineSliderValue, setLineSliderValue] = useState<[number, number]>([
    sliderSettings.currentValuation,
    direction === 'long' ? sliderSettings.max : sliderSettings.min,
  ])

  const trackColor = useMemo(() => {
    const current = lineSliderValue[0]
    const exit = lineSliderValue[1]
    const loss = direction === 'long' ? exit < current : current <= exit
    return loss ? 'error' : 'success'
  }, [direction, lineSliderValue])

  const message = useMemo(() => {
    const exit = lineSliderValue[1]

    const exitProfitLoss = getProfitLossOnExit(direction, exit, +openTradeAmount)
    const dynamicProfitLossMessage = trackColor === 'success' ? 'profit' : 'loss'

    if (!exitProfitLoss?.expectedProfitLoss || !exitProfitLoss?.expectedProfitLossPercentage)
      return null
    return (
      <Message>
        If the market resolves at {sliderNumFormatter(exit)}, your {dynamicProfitLossMessage} would
        be ≈{toUsd(exitProfitLoss?.expectedProfitLoss)}
        <ProfitLossPercent
          value={exitProfitLoss?.expectedProfitLossPercentage}
          showPlusSign
          percentagePrecision={2}
          format={(percentValue): string => `(${percentValue})`}
        />
      </Message>
    )
  }, [lineSliderValue, trackColor, direction, getProfitLossOnExit, openTradeAmount])

  return (
    <Wrapper>
      <StyledSubtitle tooltip={<EstimateYourProfitLoss />}>
        Estimate your Profit/Loss
      </StyledSubtitle>
      <SliderWrapper>
        <Slider
          labelSpacing="normal"
          value={lineSliderValue as [number, number]}
          min={sliderSettings.min}
          max={sliderSettings.max}
          disableSmallThumb
          step={getStepWithTwoDecimals(lineSliderValue[1])}
          onChange={(n: SliderValue): void => {
            if (Array.isArray(n)) {
              const [, right] = n
              setLineSliderValue([sliderSettings.currentValuation, right])
            }
          }}
          handlesCanPassThrough
          labelPosition="side"
          numberFormatter={sliderNumFormatter}
          tooltipLabels={['Current', 'Exit']}
          thumbStyles={['line', 'pill']}
          tooltipBackgrounds={['sliderTooltipBackground', trackColor]}
          trackColor={trackColor}
          trackUnderlyingColor="neutral6"
        />
      </SliderWrapper>
      <AlertWrapper>
        <Alert message={message} background="accentInfo" color="neutral3" />
      </AlertWrapper>
    </Wrapper>
  )
}

export default observer(EstimateProfitLoss)

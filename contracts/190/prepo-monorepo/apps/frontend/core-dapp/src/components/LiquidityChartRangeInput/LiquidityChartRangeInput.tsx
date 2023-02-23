import { format } from 'd3'
import { useCallback, useMemo } from 'react'
import styled from 'styled-components'
import Chart from './Chart'
import { Bound, BrushLabelValueType, ChartEntry, FeeAmount, ZoomLevels } from './types'

const zoomLevels: Record<FeeAmount, ZoomLevels> = {
  [FeeAmount.LOW]: {
    initialMin: 0.999,
    initialMax: 1.001,
    min: 0.00001,
    max: 1.5,
  },
  [FeeAmount.MEDIUM]: {
    initialMin: 0.5,
    initialMax: 2,
    min: 0.00001,
    max: 20,
  },
  [FeeAmount.HIGH]: {
    initialMin: 0.5,
    initialMax: 2,
    min: 0.00001,
    max: 20,
  },
}

const Wrapper = styled.div`
  min-height: 200px;
`

const ChartWrapper = styled.div`
  align-content: center;
  justify-content: center;
  position: relative;
`

type Props = {
  data: ChartEntry[]
  feeAmount?: FeeAmount
  ticksAtLimit: { [bound in Bound]?: boolean | undefined }
  price?: number
  lowerPrice?: number
  upperPrice?: number
  onLeftRangeInput?: (typedValue: number) => void
  onRightRangeInput?: (typedValue: number) => void
  brushLimit?: { [Bound.LOWER]?: number; [Bound.UPPER]?: number }
}

const LiquidityChartRangeInput: React.FC<Props> = ({
  data,
  feeAmount,
  ticksAtLimit,
  price = 0,
  lowerPrice,
  upperPrice,
  onLeftRangeInput,
  onRightRangeInput,
  brushLimit,
}) => {
  const onBrushDomainChange = useCallback(
    (domain, mode) => {
      let leftRangeValue = Number(domain[0])
      const rightRangeValue = Number(domain[1])

      if (leftRangeValue <= 0) {
        leftRangeValue = 1 / 10 ** 6
      }
      if (
        (!ticksAtLimit[Bound.LOWER] || mode === 'handle' || mode === 'reset') &&
        leftRangeValue > 0
      ) {
        onLeftRangeInput?.(parseInt(leftRangeValue.toFixed(6), 10))
      }

      if ((!ticksAtLimit[Bound.UPPER] || mode === 'reset') && rightRangeValue > 0) {
        if (rightRangeValue < 1e35) {
          onRightRangeInput?.(parseInt(rightRangeValue.toFixed(6), 10))
        }
      }
    },
    [onLeftRangeInput, onRightRangeInput, ticksAtLimit]
  )

  const brushDomain: [number, number] | undefined = useMemo(
    () => (upperPrice && lowerPrice ? [lowerPrice, upperPrice] : undefined),
    [lowerPrice, upperPrice]
  )

  const brushLabelValue: BrushLabelValueType = useCallback(
    (direction, value) => {
      if (!price) return ''

      if (direction === 'left' && ticksAtLimit[Bound.LOWER]) return '0'
      if (direction === 'right' && ticksAtLimit[Bound.UPPER]) return '∞'

      const percent =
        (value < price ? -1 : 1) * ((Math.max(value, price) - Math.min(value, price)) / price) * 100

      return price ? `${format(Math.abs(percent) > 1 ? '.2~s' : '.2~f')(percent)}%` : ''
    },
    [price, ticksAtLimit]
  )

  return (
    <Wrapper>
      <ChartWrapper>
        {data.length ? (
          <Chart
            densityData={data}
            currentPrice={price}
            brushLabelValue={brushLabelValue}
            brushDomain={brushDomain}
            onBrushDomainChange={onBrushDomainChange}
            zoomLevels={zoomLevels[feeAmount ?? FeeAmount.MEDIUM]}
            brushLimit={brushLimit}
          />
        ) : null}
      </ChartWrapper>
    </Wrapper>
  )
}

export default LiquidityChartRangeInput

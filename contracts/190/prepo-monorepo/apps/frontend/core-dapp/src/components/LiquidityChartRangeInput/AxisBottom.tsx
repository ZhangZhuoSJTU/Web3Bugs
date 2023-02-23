import { Axis as d3Axis, axisBottom, NumberValue, ScaleLinear, select } from 'd3'
import { useMemo } from 'react'
import styled from 'styled-components'
import { numberFormatter } from '../../utils/numberFormatter'

const { significantDigits } = numberFormatter

const StyledGroup = styled.g`
  line {
    display: none;
  }

  text {
    color: ${({ theme }): string => theme.color.neutral1};
    font-family: ${({ theme }): string => theme.fontFamily.primary};
    font-size: ${({ theme }): string => theme.fontSize.xs};
    font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
    transform: translateY(5px);
  }
`

type AxisProps = {
  axisGenerator: d3Axis<NumberValue>
}

const Axis: React.FC<AxisProps> = ({ axisGenerator }) => {
  const axisRef = (axis: SVGGElement): unknown =>
    axis &&
    select(axis)
      .call(axisGenerator)
      .call((g) => g.select('.domain').remove())
  return <g ref={axisRef} />
}

type Props = {
  xScale: ScaleLinear<number, number>
  innerHeight: number
  offset?: number
}

export const AxisBottom: React.FC<Props> = ({ xScale, innerHeight, offset = 0 }) =>
  useMemo(
    () => (
      <StyledGroup transform={`translate(0, ${innerHeight + offset})`}>
        <Axis
          axisGenerator={axisBottom(xScale)
            .ticks(6)
            .tickFormat((value): string => significantDigits(value.toString()))}
        />
      </StyledGroup>
    ),
    [innerHeight, offset, xScale]
  )

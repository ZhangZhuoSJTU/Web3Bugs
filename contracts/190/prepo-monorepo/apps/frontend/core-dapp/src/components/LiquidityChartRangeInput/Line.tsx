import { ScaleLinear } from 'd3'
import { useMemo } from 'react'
import styled from 'styled-components'

const StyledLine = styled.line`
  stroke: ${({ theme }): string => theme.color.neutral3};
  stroke-width: 1px;
`

type Props = {
  value: number
  xScale: ScaleLinear<number, number>
  innerHeight: number
}

export const Line: React.FC<Props> = ({ value, xScale, innerHeight }) =>
  useMemo(
    () => <StyledLine x1={xScale(value)} y1="0" x2={xScale(value)} y2={innerHeight} />,
    [value, xScale, innerHeight]
  )

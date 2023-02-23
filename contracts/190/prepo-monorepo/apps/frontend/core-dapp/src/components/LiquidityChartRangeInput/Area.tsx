import { area, curveStepAfter, ScaleLinear } from 'd3'
import { useMemo } from 'react'
import styled, { Color, useTheme } from 'styled-components'

import { ChartEntry } from './types'

const Path = styled.path<{ fill: string | undefined }>`
  fill: ${({ fill, theme }): string => fill ?? theme.color.success};
  opacity: ${({ fill }): number => (fill ? 1 : 0.5)};
  stroke: ${({ fill, theme }): string => fill ?? theme.color.success};
`

type Props = {
  densityData: ChartEntry[]
  xScale: ScaleLinear<number, number>
  yScale: ScaleLinear<number, number>
  xValue: (d: ChartEntry) => number
  yValue: (d: ChartEntry) => number
  fill?: keyof Color | undefined
  innerWidth: number
}

export const Area: React.FC<Props> = ({
  densityData,
  xScale,
  yScale,
  xValue,
  yValue,
  fill,
  innerWidth,
}) => {
  const theme = useTheme()
  return useMemo(
    () => (
      <Path
        fill={fill && theme.color[fill]}
        d={
          area()
            .curve(curveStepAfter)
            .x((d: unknown) => xScale(xValue(d as ChartEntry)))
            .y1((d: unknown) => yScale(yValue(d as ChartEntry)))
            .y0(yScale(0))(
            densityData.filter((d) => {
              const value = xScale(xValue(d))
              return value > 0 && value <= innerWidth
            }) as Iterable<[number, number]>
          ) ?? undefined
        }
      />
    ),
    [fill, densityData, xScale, xValue, yScale, yValue, theme.color, innerWidth]
  )
}

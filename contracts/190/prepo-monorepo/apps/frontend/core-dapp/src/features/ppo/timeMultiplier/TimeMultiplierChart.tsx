import { Area, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line } from 'recharts'
import styled, { useTheme } from 'styled-components'
import { spacingIncrement, media } from 'prepo-ui'
import { useMemo, FC } from 'react'
import {
  generateMultiplierData,
  labelFormatter,
  X_AXIS_TICKS,
  Y_AXIS_TICKS,
} from './chartUtilities'
import Marker from './Marker'
import { useRandomGeneratedIdOnResize } from '../../../hooks/useRandomGeneratedIdOnResize'
import useResponsive from '../../../hooks/useResponsive'

export const ChartContainer = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  justify-content: center;
  overflow: hidden;
  width: 100%;
  .recharts-layer.recharts-active-dot {
    circle {
      r: 6;
      stroke-width: 4;
      ${media.desktop`
        stroke-width: 8;
        r: 13;
      `}
    }
  }
  .recharts-tooltip-cursor {
    stroke: ${({ theme }): string => theme.color.primary};
    stroke-width: 1;
    ${media.desktop`
      stroke-width: 2;
    `}
  }
  .recharts-cartesian-axis-tick-value {
    fill: ${({ theme }): string => theme.color.neutral3};
    font-family: ${({ theme }): string => theme.fontFamily.primary};
    font-size: ${({ theme }): string => theme.fontSize.xs};
    font-weight: ${({ theme }): number => theme.fontWeight.medium};
    line-height: ${spacingIncrement(18)};
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.md};
      line-height: ${spacingIncrement(27)};
    `}
  }
  .recharts-tooltip-wrapper {
    .recharts-default-tooltip {
      align-items: center;
      border-radius: 5px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      .recharts-tooltip-label {
        color: ${({ theme }): string => theme.color.neutral2};
        font-size: ${({ theme }): string => theme.fontSize.xs};
        font-weight: ${({ theme }): number => theme.fontWeight.regular};
        line-height: ${spacingIncrement(15)};
        margin-top: ${spacingIncrement(9)};
        ${media.desktop`
          font-size: ${({ theme }): string => theme.fontSize.sm};
          line-height: ${spacingIncrement(27)};
          margin-top: ${spacingIncrement(12)};
        `}
      }
      .recharts-tooltip-item-list {
        * {
          color: ${({ theme }): string => theme.color.primary};
          font-size: ${({ theme }): string => theme.fontSize.sm};
          font-weight: ${({ theme }): number => theme.fontWeight.medium};
          padding: 0;
          ${media.desktop`
            font-size: ${({ theme }): string => theme.fontSize.base};
          `}
        }
      }
    }
  }
`

const TimeMultiplierChart: FC<{ currentWeek?: number }> = ({ currentWeek }) => {
  const data = useMemo(() => generateMultiplierData(currentWeek), [currentWeek])
  const { isDesktop } = useResponsive()
  const theme = useTheme()
  const padding = isDesktop ? 16 : 8
  const id = useRandomGeneratedIdOnResize()

  return (
    // generate random key to completely re-render chart on resize
    <ChartContainer key={id}>
      <ResponsiveContainer height="100%" width="100%" minHeight={300}>
        <ComposedChart data={data} margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7678DD" stopOpacity={1} />
              <stop offset="100%" stopColor="#BCBEFE" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="week" axisLine={false} ticks={X_AXIS_TICKS} tickLine={false} />
          <YAxis
            dataKey="value"
            domain={['dataMin', 'dataMax']}
            ticks={Y_AXIS_TICKS}
            tickFormatter={(m): string => `${m}x`}
            axisLine={false}
            padding={{ bottom: padding }}
            tickLine={false}
          />
          <Tooltip
            cursor
            labelFormatter={labelFormatter}
            wrapperStyle={{
              top: 0,
              left: 0,
            }}
            contentStyle={{
              border: 'none',
              margin: 0,
              padding: isDesktop
                ? `${spacingIncrement(10)} ${spacingIncrement(20)}`
                : `${spacingIncrement(10)} ${spacingIncrement(10)} 0`,
            }}
          />
          <Area
            type="stepAfter"
            name="Multiplier"
            dataKey="value"
            stroke={theme.color.primary}
            strokeWidth={2}
            fill="url(#area)"
          />
          <Line
            dataKey="current"
            stroke={theme.color.primary}
            dot={<Marker />}
            tooltipType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

export default TimeMultiplierChart

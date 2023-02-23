import { spacingIncrement } from 'prepo-ui'
import React, { FC, useMemo } from 'react'
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from 'styled-components'
import { ChartContainer } from './TimeMultiplierChart'
import {
  DEFAULT_FEE_RATE,
  DEFAULT_TOOLTIP_PRECISION,
  DEFAULT_TOTAL_WEEK,
  generateFeeData,
  UnstakingFeeChartProps,
} from './chartUtilities'
import Marker from './Marker'
import { useRandomGeneratedIdOnResize } from '../../../hooks/useRandomGeneratedIdOnResize'
import useResponsive from '../../../hooks/useResponsive'

/* taken from
 https://github.com/mstable/mStable-apps/blob/master/apps/governance/src/app/pages/Stake/WithdrawGraph.tsx */

const UnstakingFeeChart: FC<Partial<UnstakingFeeChartProps>> = ({
  feeRate = DEFAULT_FEE_RATE,
  tooltipPrecision = DEFAULT_TOOLTIP_PRECISION,
  totalWeek = DEFAULT_TOTAL_WEEK,
  currentWeek,
}) => {
  const graphData = useMemo(() => {
    const data = generateFeeData({ feeRate, totalWeek, currentWeek })
    const ticks = [...new Set(data.map(({ week }) => week))]
    return { data, ticks }
  }, [feeRate, totalWeek, currentWeek])
  const { isDesktop } = useResponsive()
  const theme = useTheme()
  const id = useRandomGeneratedIdOnResize()

  return (
    // generate random key to completely re-render chart on resize
    <ChartContainer key={id}>
      <ResponsiveContainer height="100%" width="100%" minHeight={300}>
        <ComposedChart data={graphData.data} margin={{ top: 10 }}>
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7678DD" stopOpacity={1} />
              <stop offset="100%" stopColor="#BCBEFE" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="week"
            tickFormatter={(week): string => `${week}`}
            axisLine={false}
            padding={{ left: isDesktop ? 30 : 10 }}
            tickLine={false}
            ticks={graphData.ticks}
          />
          <YAxis
            tickCount={3}
            tickFormatter={(fee): string => `${fee}%`}
            axisLine={false}
            padding={{ bottom: isDesktop ? 20 : 10 }}
            tickLine={false}
          />
          <Tooltip
            cursor
            labelFormatter={(week): string => `+${week} weeks`}
            formatter={(fee: number): string => `${fee.toFixed(tooltipPrecision)}%`}
            wrapperStyle={{
              top: 0,
              left: 0,
            }}
            contentStyle={{
              border: 'none',
              background: theme.color.white,
              margin: 0,
              padding: isDesktop
                ? `${spacingIncrement(10)} ${spacingIncrement(20)}`
                : `${spacingIncrement(10)} ${spacingIncrement(10)} 0`,
            }}
          />
          <Area
            type="monotone"
            name="Fee: "
            dataKey="value"
            stroke="blue"
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

export default UnstakingFeeChart

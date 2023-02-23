import { max, scaleLinear, ZoomTransform } from 'd3'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { centered, media } from 'prepo-ui'
import Skeleton from 'react-loading-skeleton'
import { Area } from './Area'
import { AxisBottom } from './AxisBottom'
import { Brush } from './Brush'
import { Line } from './Line'
import { Bound, BrushLabelValueType, ChartEntry, ZoomLevels } from './types'
import Zoom, { ZoomOverlay } from './Zoom'
import { numberFormatter } from '../../utils/numberFormatter'

const { significantDigits } = numberFormatter

export const xAccessor = (d: ChartEntry): number => d.price0
export const yAccessor = (d: ChartEntry): number => d.activeLiquidity

const margins = { top: 10, right: 2, bottom: 20, left: 0 }

const Header = styled.div`
  position: relative;
`

const Title = styled.div`
  ${centered}
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
`

type Props = {
  id?: string
  densityData: ChartEntry[]
  currentPrice?: number
  width?: number
  height?: number
  brushLabelValue: BrushLabelValueType
  brushDomain: [number, number] | undefined
  onBrushDomainChange: (domain: [number, number], mode: string | undefined) => void
  zoomLevels: ZoomLevels
  brushLimit?: { [Bound.LOWER]?: number; [Bound.UPPER]?: number }
}

const Chart: React.FC<Props> = ({
  id = 'liquidityChartRangeInput',
  densityData,
  currentPrice,
  width = 400,
  height = 200,
  brushDomain,
  brushLabelValue,
  onBrushDomainChange,
  zoomLevels,
  brushLimit,
}) => {
  const zoomRef = useRef<SVGRectElement>(null)
  const [zoom, setZoom] = useState<ZoomTransform | null | undefined>(undefined)

  const [innerHeight, innerWidth] = useMemo(
    () => [height - margins.top - margins.bottom, width - margins.left - margins.right],
    [width, height]
  )

  const { xScale, yScale } = useMemo(() => {
    const scales = {
      xScale: scaleLinear()
        .domain([
          (currentPrice ?? 0) * zoomLevels.initialMin,
          (currentPrice ?? 0) * zoomLevels.initialMax,
        ] as number[])
        .range([0, innerWidth]),
      yScale: scaleLinear()
        .domain([0, max(densityData, yAccessor)] as number[])
        .range([innerHeight, 0]),
    }

    if (zoom) {
      const newXscale = zoom.rescaleX(scales.xScale)
      scales.xScale.domain(newXscale.domain())
    }

    return scales
  }, [
    currentPrice,
    zoomLevels.initialMin,
    zoomLevels.initialMax,
    innerWidth,
    densityData,
    innerHeight,
    zoom,
  ])

  const xScaleLimit = useMemo(
    () =>
      brushLimit && brushLimit.UPPER !== undefined && brushLimit.LOWER !== undefined
        ? scaleLinear().domain([brushLimit.LOWER, brushLimit.UPPER])
        : undefined,
    [brushLimit]
  )

  useEffect(() => {
    setZoom(null)
  }, [zoomLevels])

  useEffect(() => {
    if (!brushDomain) {
      onBrushDomainChange(xScale.domain() as [number, number], undefined)
    }
  }, [brushDomain, onBrushDomainChange, xScale])

  const onResetBrush = (): void => {
    onBrushDomainChange(
      [
        (currentPrice ?? 0) * zoomLevels.initialMin,
        (currentPrice ?? 0) * zoomLevels.initialMax,
      ] as [number, number],
      'reset'
    )
  }

  return (
    <>
      <Header>
        <Zoom
          svg={zoomRef.current}
          xScale={xScale}
          setZoom={setZoom}
          width={innerWidth}
          height={height}
          resetBrush={onResetBrush}
          zoomLevels={zoomLevels}
        />
        <Title>
          {currentPrice === undefined ? (
            <Skeleton height={22} width={200} />
          ) : (
            `Current Valuation: $${significantDigits(currentPrice)}`
          )}
        </Title>
      </Header>
      {currentPrice === undefined ||
      brushLimit?.UPPER === undefined ||
      brushLimit?.LOWER === undefined ? (
        <Skeleton height={200} width="100%" />
      ) : (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <clipPath id={`${id}-chart-clip`}>
              <rect x="0" y="0" width={innerWidth} height={height} />
            </clipPath>

            {brushDomain && (
              // mask to highlight selected area
              <mask id={`${id}-chart-area-mask`}>
                <rect
                  fill="white"
                  x={xScale(brushDomain[0])}
                  y="0"
                  width={xScale(brushDomain[1]) - xScale(brushDomain[0])}
                  height={innerHeight}
                />
              </mask>
            )}
          </defs>

          <g transform={`translate(${margins.left},${margins.top})`}>
            <g clipPath={`url(#${id}-chart-clip)`}>
              <Area
                innerWidth={innerWidth}
                densityData={densityData}
                xScale={xScale}
                yScale={yScale}
                xValue={xAccessor}
                yValue={yAccessor}
              />

              {brushDomain && (
                // duplicate area chart with mask for selected area
                <g mask={`url(#${id}-chart-area-mask)`}>
                  <Area
                    innerWidth={innerWidth}
                    densityData={densityData}
                    xScale={xScale}
                    yScale={yScale}
                    xValue={xAccessor}
                    yValue={yAccessor}
                    fill="success"
                  />
                </g>
              )}

              <Line value={currentPrice ?? 0} xScale={xScale} innerHeight={innerHeight} />

              <AxisBottom xScale={xScale} innerHeight={innerHeight} />
            </g>

            <ZoomOverlay width={innerWidth} height={height} ref={zoomRef} />

            <Brush
              id={id}
              xScale={xScale}
              brushLabelValue={brushLabelValue}
              brushExtent={brushDomain ?? (xScale.domain() as [number, number])}
              innerWidth={innerWidth}
              innerHeight={innerHeight}
              setBrushExtent={onBrushDomainChange}
              leftHandleColor="liquidityBrush"
              rightHandleColor="primary"
              brushLimitExtent={xScaleLimit}
            />
          </g>
        </svg>
      )}
    </>
  )
}

export default Chart

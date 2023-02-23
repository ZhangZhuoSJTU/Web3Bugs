import { BrushBehavior, brushX, D3BrushEvent, ScaleLinear, select } from 'd3'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled, { Color, useTheme } from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import { brushHandleAccentPath, brushHandlePath, OffScreenHandle } from './svg'
import { BrushLabelValueType } from './types'

const Handle = styled.path<{ color: string }>`
  cursor: ew-resize;
  fill: ${({ color }): string => color};
  pointer-events: none;
  stroke: ${({ color }): string => color};
  stroke-width: 3;
`

const HandleAccent = styled.path`
  cursor: ew-resize;
  opacity: 0.6;
  pointer-events: none;
  stroke: ${({ theme }): string => theme.color.white};
  stroke-width: ${spacingIncrement(1.3)};
`

const LabelGroup = styled.g<{ visible: boolean }>`
  opacity: ${({ visible }): string => (visible ? '1' : '0')};
  transition: opacity 300ms;
`

const TooltipBackground = styled.rect`
  border-radius: 3px;
  fill: ${({ theme }): string => theme.color.neutral7};
`

const Tooltip = styled.text`
  fill: ${({ theme }): string => theme.color.neutral1};
  font-size: 13px;
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  text-anchor: middle;
`

// flips the handles draggers when close to the container edges
const FLIP_HANDLE_THRESHOLD_PX = 20

// margin to prevent tick snapping from putting the brush off screen
const BRUSH_EXTENT_MARGIN_PX = 2

/**
 * Returns true if every element in `a` maps to the
 * same pixel coordinate as elements in `b`
 */
const compare = (
  a: [number, number],
  b: [number, number],
  xScale: ScaleLinear<number, number>
): boolean => {
  // normalize pixels to 1 decimals
  const aNorm = a.map((x) => xScale(x).toFixed(1))
  const bNorm = b.map((x) => xScale(x).toFixed(1))
  return aNorm.every((v, i) => v === bNorm[i])
}

type Props = {
  id: string
  xScale: ScaleLinear<number, number>
  brushLabelValue: BrushLabelValueType
  brushExtent: [number, number]
  setBrushExtent: (extent: [number, number], mode: string | undefined) => void
  innerWidth: number
  innerHeight: number
  leftHandleColor: keyof Color
  rightHandleColor: keyof Color
  brushLimitExtent?: ScaleLinear<number, number>
}

export const Brush: React.FC<Props> = ({
  id,
  xScale,
  brushLabelValue,
  brushExtent,
  setBrushExtent,
  innerWidth,
  innerHeight,
  leftHandleColor,
  rightHandleColor,
  brushLimitExtent,
}) => {
  const brushRef = useRef<SVGGElement | null>(null)
  const brushBehavior = useRef<BrushBehavior<SVGGElement> | null>(null)
  const theme = useTheme()
  const leftHandleColorValue = useMemo(
    () => theme.color[leftHandleColor],
    [leftHandleColor, theme.color]
  )
  const rightHandleColorValue = useMemo(
    () => theme.color[rightHandleColor],
    [rightHandleColor, theme.color]
  )
  // only used to drag the handles on brush for performance
  const [localBrushExtent, setLocalBrushExtent] = useState<[number, number] | null>(brushExtent)
  const [showLabels, setShowLabels] = useState(false)
  const [hovering, setHovering] = useState(false)

  const previousBrushRef = useRef<[number, number]>(brushExtent)

  const brushed = useCallback(
    (event: D3BrushEvent<unknown>) => {
      const { type, selection, mode } = event

      if (!selection) {
        setLocalBrushExtent(null)
        return
      }

      const scaled = (selection as [number, number]).map(xScale.invert) as [number, number]

      // avoid infinite render loop by checking for change
      if (type === 'end' && !compare(brushExtent, scaled, xScale)) {
        setBrushExtent(scaled, mode)
      }

      setLocalBrushExtent(scaled)
    },
    [xScale, brushExtent, setBrushExtent]
  )

  // keep local and external brush extent in sync
  // i.e. snap to ticks on bruhs end
  useEffect(() => {
    setLocalBrushExtent(brushExtent)
  }, [brushExtent])

  // initialize the brush
  useEffect(() => {
    if (!brushRef.current) return

    brushBehavior.current = brushX<SVGGElement>()
      .extent([
        [
          brushLimitExtent
            ? xScale(brushLimitExtent?.domain()[0])
            : Math.max(0 + BRUSH_EXTENT_MARGIN_PX, xScale(0)),
          0,
        ],
        [
          brushLimitExtent
            ? xScale(brushLimitExtent?.domain()[1])
            : innerWidth - BRUSH_EXTENT_MARGIN_PX,
          innerHeight,
        ],
      ])
      .handleSize(30)
      .on('brush end', brushed)

    brushBehavior.current(select(brushRef.current))

    if (previousBrushRef.current && compare(brushExtent, previousBrushRef.current, xScale)) {
      select(brushRef.current)
        .transition()
        .call(brushBehavior.current.move as never, brushExtent.map(xScale))
    }

    // brush linear gradient
    select(brushRef.current)
      .selectAll('.selection')
      .attr('stroke', 'none')
      .attr('fill-opacity', '0.1')
      .attr('fill', `url(#${id}-gradient-selection)`)
  }, [
    brushExtent,
    brushLimitExtent,
    brushed,
    id,
    innerHeight,
    innerWidth,
    previousBrushRef,
    xScale,
  ])

  // respond to xScale changes only
  useEffect(() => {
    if (!brushRef.current || !brushBehavior.current) return

    brushBehavior.current.move(select(brushRef.current), brushExtent.map(xScale) as never)
  }, [brushExtent, xScale])

  // show labels when local brush changes
  useEffect(() => {
    setShowLabels(true)
    const timeout = setTimeout(() => setShowLabels(false), 1500)
    return (): void => clearTimeout(timeout)
  }, [localBrushExtent])

  // variables to help render the SVGs
  const flipLeftHandle = localBrushExtent && xScale(localBrushExtent[0]) > FLIP_HANDLE_THRESHOLD_PX
  const flipRightHandle =
    localBrushExtent && xScale(localBrushExtent[1]) > innerWidth - FLIP_HANDLE_THRESHOLD_PX

  const showLeftArrow =
    localBrushExtent && (xScale(localBrushExtent[0]) < 0 || xScale(localBrushExtent[1]) < 0)
  const showRightArrow =
    localBrushExtent &&
    (xScale(localBrushExtent[0]) > innerWidth || xScale(localBrushExtent[1]) > innerWidth)

  const leftHandleInView =
    localBrushExtent &&
    xScale(localBrushExtent[0]) >= 0 &&
    xScale(localBrushExtent[0]) <= innerWidth
  const rightHandleInView =
    localBrushExtent &&
    xScale(localBrushExtent[1]) >= 0 &&
    xScale(localBrushExtent[1]) <= innerWidth

  return useMemo(
    () => (
      <>
        <defs>
          <linearGradient id={`${id}-gradient-selection`} x1="0%" y1="100%" x2="100%" y2="100%">
            <stop stopColor={leftHandleColorValue} />
            <stop stopColor={rightHandleColorValue} offset="1" />
          </linearGradient>

          {/* clips at exactly the svg area */}
          <clipPath id={`${id}-brush-clip`}>
            <rect x="0" y="0" width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>

        {/* will host the d3 brush */}
        <g
          ref={brushRef}
          clipPath={`url(#${id}-brush-clip)`}
          onMouseEnter={(): void => setHovering(true)}
          onMouseLeave={(): void => setHovering(false)}
        />

        {/* custom brush handles */}
        {localBrushExtent && (
          <>
            {/* left handle */}
            {leftHandleInView ? (
              <g
                transform={`translate(${Math.max(0, xScale(localBrushExtent[0]))}, 0), scale(${
                  flipLeftHandle ? '-1' : '1'
                }, 1)`}
              >
                <g>
                  <Handle color={leftHandleColorValue} d={brushHandlePath(innerHeight)} />
                  <HandleAccent d={brushHandleAccentPath()} />
                </g>

                <LabelGroup
                  transform={`translate(50,0), scale(${flipLeftHandle ? '1' : '-1'}, 1)`}
                  visible={showLabels || hovering}
                >
                  <TooltipBackground y="0" x="-30" height="30" width="60" rx="8" />
                  <Tooltip transform="scale(-1, 1)" y="15" dominantBaseline="middle">
                    {brushLabelValue('left', localBrushExtent[0])}
                  </Tooltip>
                </LabelGroup>
              </g>
            ) : null}

            {/* right handle */}
            {rightHandleInView ? (
              <g
                transform={`translate(${xScale(localBrushExtent[1])}, 0), scale(${
                  flipRightHandle ? '-1' : '1'
                }, 1)`}
              >
                <g>
                  <Handle color={rightHandleColorValue} d={brushHandlePath(innerHeight)} />
                  <HandleAccent d={brushHandleAccentPath()} />
                </g>

                <LabelGroup
                  transform={`translate(50,0), scale(${flipRightHandle ? '-1' : '1'}, 1)`}
                  visible={showLabels || hovering}
                >
                  <TooltipBackground y="0" x="-30" height="30" width="60" rx="8" />
                  <Tooltip y="15" dominantBaseline="middle">
                    {brushLabelValue('right', localBrushExtent[1])}
                  </Tooltip>
                </LabelGroup>
              </g>
            ) : null}

            {showLeftArrow && <OffScreenHandle color={leftHandleColorValue} />}

            {showRightArrow && (
              <g transform={`translate(${innerWidth}, 0) scale(-1, 1)`}>
                <OffScreenHandle color={rightHandleColorValue} />
              </g>
            )}
          </>
        )}
      </>
    ),
    [
      id,
      leftHandleColorValue,
      rightHandleColorValue,
      innerWidth,
      innerHeight,
      localBrushExtent,
      leftHandleInView,
      xScale,
      flipLeftHandle,
      showLabels,
      hovering,
      brushLabelValue,
      rightHandleInView,
      flipRightHandle,
      showLeftArrow,
      showRightArrow,
    ]
  )
}

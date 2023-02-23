import {
  ScaleLinear,
  select,
  zoom,
  ZoomBehavior,
  zoomIdentity,
  ZoomTransform,
  Transition,
} from 'd3'
import { useEffect, useMemo, useRef } from 'react'
import { Row, Col } from 'antd'
import styled from 'styled-components'
import { centered, spacingIncrement, Icon } from 'prepo-ui'
import { ZoomLevels } from './types'

const Wrapper = styled(Row)`
  height: 100%;
  position: absolute;
  right: 0;
`

const ColCenter = styled(Col)`
  ${centered}
`
const IconWrapper = styled.div`
  ${centered}
  background-color: ${({ theme }): string => theme.color.primaryAccent};
  border-radius: 100%;
  cursor: pointer;
  padding: ${spacingIncrement(3)};
`

export const ZoomOverlay = styled.rect`
  cursor: grab;
  fill: transparent;
  &:active {
    cursor: grabbing;
  }
`

type Props = {
  svg: SVGElement | null
  xScale: ScaleLinear<number, number>
  setZoom: (transform: ZoomTransform) => void
  width: number
  height: number
  resetBrush: () => void
  zoomLevels: ZoomLevels
}

const Zoom: React.FC<Props> = ({ svg, xScale, setZoom, width, height, resetBrush, zoomLevels }) => {
  const zoomBehavior = useRef<ZoomBehavior<Element, unknown>>()

  type ZoomFunReturnType = Transition<Element, unknown, null, undefined> | null

  const [zoomIn, zoomOut, zoomInitial, zoomReset] = useMemo(
    () => [
      (): ZoomFunReturnType => {
        if (svg && zoomBehavior.current) {
          return select(svg as Element)
            .transition()
            .call(zoomBehavior.current.scaleBy, 2)
        }
        return null
      },
      (): ZoomFunReturnType => {
        if (svg && zoomBehavior.current) {
          select(svg as Element)
            .transition()
            .call(zoomBehavior.current.scaleBy, 0.5)
        }
        return null
      },
      (): ZoomFunReturnType => {
        if (svg && zoomBehavior.current) {
          select(svg as Element)
            .transition()
            .call(zoomBehavior.current.scaleTo, 0.5)
        }
        return null
      },
      (): ZoomFunReturnType => {
        if (svg && zoomBehavior.current) {
          select(svg as Element)
            .call(zoomBehavior.current.transform, zoomIdentity.translate(0, 0).scale(1))
            .transition()
            .call(zoomBehavior.current.scaleTo, 0.5)
        }
        return null
      },
    ],
    [svg]
  )

  useEffect(() => {
    if (!svg) return

    zoomBehavior.current = zoom()
      .scaleExtent([zoomLevels.min, zoomLevels.max])
      .extent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', ({ transform }: { transform: ZoomTransform }) => setZoom(transform))

    select(svg as Element).call(zoomBehavior.current)
  }, [
    height,
    width,
    setZoom,
    svg,
    xScale,
    zoomBehavior,
    zoomLevels,
    zoomLevels.max,
    zoomLevels.min,
  ])

  useEffect(() => {
    zoomInitial()
  }, [zoomInitial, zoomLevels])

  return (
    <Wrapper gutter={[10, 10]}>
      <ColCenter xs={8}>
        <IconWrapper
          onClick={(): void => {
            resetBrush()
            zoomReset()
          }}
        >
          <Icon
            name="reset"
            height={spacingIncrement(13)}
            width={spacingIncrement(13)}
            color="neutral1"
          />
        </IconWrapper>
      </ColCenter>
      <ColCenter xs={8}>
        <IconWrapper onClick={zoomIn}>
          <Icon
            name="zoom-in-two"
            height={spacingIncrement(15)}
            width={spacingIncrement(15)}
            color="neutral1"
          />
        </IconWrapper>
      </ColCenter>
      <ColCenter xs={8}>
        <IconWrapper onClick={zoomOut}>
          <Icon
            name="zoom-out-two"
            height={spacingIncrement(15)}
            width={spacingIncrement(15)}
            color="neutral1"
          />
        </IconWrapper>
      </ColCenter>
    </Wrapper>
  )
}

export default Zoom

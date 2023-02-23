import { IChartApi, MouseEventParams } from 'lightweight-charts'
import { RefObject, useCallback, useEffect, useState } from 'react'
import {
  CrossHairPositioner,
  CrossHairPositionerProps,
  DetailsProps,
  Position,
} from '../chart-types'

type Props = {
  chart?: IChartApi
  containerRef: RefObject<HTMLElement>
  subscribe?: boolean
}

const useCrossHairMove = ({
  chart,
  containerRef,
  subscribe = true,
}: Props): CrossHairPositioner => {
  const [crossHairMove, setCrossHairMove] = useState<MouseEventParams>()

  // handles crosshair movement changes
  const crossHairMoveHandler = useCallback(
    (params: MouseEventParams) => setCrossHairMove(params),
    []
  )

  // return a function for series component to render their own components
  const crossHairPositioner = useCallback(
    ({ detailsBoxRef, series }: CrossHairPositionerProps): DetailsProps | undefined => {
      if (!containerRef.current || !crossHairMove || !series) return undefined
      const { point, seriesPrices, time } = crossHairMove
      const containerSize = {
        height: containerRef.current.clientHeight,
        width: containerRef.current.clientWidth,
      }
      if (
        !point ||
        !time ||
        point.x < 0 ||
        point.y < 0 ||
        point.x > containerSize.width ||
        point.y > containerSize.height
      ) {
        return undefined
      }
      // space between detail box and the crosshair
      const margin = 12
      const price = seriesPrices.get(series)
      // this is the distance from top to cursor in pixel
      const topToCursor = series.priceToCoordinate(price as number)
      const detailsBoxSize = {
        height: detailsBoxRef.current?.clientHeight || 0,
        width: detailsBoxRef.current?.clientWidth || 0,
      }

      // position to the left of cursor by default
      const position: Position = {
        bottom: 'auto',
        left: 'auto',
        right: containerSize.width - point.x + margin,
        top: +(topToCursor || 0) - detailsBoxSize.height / 2,
      }

      const exceedLeft = point.x - 0 < margin + detailsBoxSize.width
      if (exceedLeft) {
        position.left = point.x + margin
        position.right = 'auto'
      }

      const exceedTop = +position.top < 0
      if (exceedTop) {
        position.top = 0
      }
      const exceedBottom = +position.top + detailsBoxSize.height > containerSize.height
      if (exceedBottom) {
        position.top = 'auto'
        position.bottom = 0
      }

      const details = {
        point,
        position,
        price: price as number,
        time,
      }
      return details
    },
    [containerRef, crossHairMove]
  )

  useEffect(() => {
    if (subscribe) {
      chart?.subscribeCrosshairMove(crossHairMoveHandler)
    } else {
      chart?.unsubscribeCrosshairMove(crossHairMoveHandler)
    }
    return (): void => {
      chart?.unsubscribeCrosshairMove(crossHairMoveHandler)
    }
  }, [chart, crossHairMoveHandler, subscribe])

  return crossHairPositioner
}

export default useCrossHairMove

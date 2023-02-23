import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useSwipeable } from 'react-swipeable'
import { CurvedCarouselItemData } from './CurvedCarouselItemData'
import { CurvedCarouselItem } from './CurvedCarouselItem'
import { CurvedCarouselAnimationDirection } from './CurvedCarouselShared'
import { CurvedCarouselItemIcon } from './CurvedCarouselItemIcon'
import { IconButton } from '../../IconButton'

const getIndexAt = (index: number, arr: unknown[]): number => (arr.length + index) % arr.length
const getItemAt = <T,>(items: T[], index: number): T => items[getIndexAt(index, items)]

export type CurvedCarouselProps = {
  items: CurvedCarouselItemData[]
  startAt?: number
}

export const CurvedCarousel: FC<CurvedCarouselProps> = ({ items = [], startAt = 1 }) => {
  const [state, setState] = useState<{
    prevIndex: number
    index: number
    direction?: CurvedCarouselAnimationDirection
    moving?: boolean
  }>({
    prevIndex: -1,
    index: startAt,
  })

  // disables the buttons while animation is in progress
  useEffect(() => {
    if (state.moving) {
      // make sure the duration is greater or equal than CAROUSEL_ANIM_DURATION in tailwind.config.js
      const timeout = setTimeout(() => setState((prev) => ({ ...prev, moving: false })), 400)
      return (): void => clearTimeout(timeout)
    }
    return undefined
  }, [state.moving])

  const { displayedItems, currItem, prevItem } = useMemo(
    () => ({
      displayedItems: [
        getItemAt(items, state.index - 1),
        getItemAt(items, state.index),
        getItemAt(items, state.index + 1),
      ].map((item) => ({ ...item, active: state.index === items.indexOf(item) })),
      currItem: getItemAt(items, state.index),
      prevItem: getItemAt(items, state.prevIndex),
    }),
    [items, state.index, state.prevIndex]
  )

  const handleShowPrev = useCallback(
    () =>
      setState(({ index }) => ({
        index: getIndexAt(index - 1, items),
        prevIndex: index,
        direction: 'prev',
        moving: true,
      })),
    [items]
  )
  const handleShowNext = useCallback(
    () =>
      setState(({ index }) => ({
        index: getIndexAt(index + 1, items),
        prevIndex: index,
        direction: 'next',
        moving: true,
      })),
    [items]
  )

  const handlers = useSwipeable({
    onSwipedRight: handleShowPrev,
    onSwipedLeft: handleShowNext,
    preventDefaultTouchmoveEvent: true,
  })

  if (items.length < 3) return <div>Carousel requires 3 items</div>

  return (
    <div {...handlers} className="relative">
      <div className="flex absolute top-3 left-0 gap-[134px] justify-between items-center px-8 w-full sm:justify-center">
        <IconButton
          aria-label="Previous"
          icon="chevronRightRound"
          className="z-10 w-5 h-5 bg-transparent rotate-180 sm:w-[30px] sm:h-[30px]"
          iconClass="w-full h-full"
          onClick={handleShowPrev}
          disabled={state.moving}
        />
        <IconButton
          aria-label="Next"
          icon="chevronRightRound"
          className="z-10 w-5 h-5 bg-transparent sm:w-[30px] sm:h-[30px]"
          iconClass="w-full h-full"
          onClick={handleShowNext}
          disabled={state.moving}
        />
      </div>
      <div className="overflow-hidden absolute top-0 left-0 w-full h-[276px]">
        <div className="relative">
          <div
            key={`${state.index}-${state.direction}`}
            className="absolute top-0 left-1/2 w-full max-w-[525px] translate-x-[-262.5px] sm:max-w-[1050px] sm:translate-x-[-525px]"
          >
            {/* circle */}
            <div className="relative mt-6 w-[525px] h-[525px] rounded-full border border-prepo/10 sm:w-[1050px] sm:h-[1050px]" />
            {/* items moving in */}
            <CurvedCarouselItemIcon
              item={displayedItems[0]}
              position="left"
              direction={state.direction}
              onClick={state.moving ? undefined : handleShowPrev}
            />
            <CurvedCarouselItemIcon
              item={displayedItems[1]}
              position="center"
              direction={state.direction}
            />
            <CurvedCarouselItemIcon
              item={displayedItems[2]}
              position="right"
              direction={state.direction}
              onClick={state.moving ? undefined : handleShowNext}
            />
            {/* item moving out */}
            {state.direction && (
              <CurvedCarouselItemIcon
                item={displayedItems[state.direction === 'prev' ? 0 : 2]}
                position="out"
                direction={state.direction}
              />
            )}
          </div>
        </div>
      </div>
      <div
        key={`${state.prevIndex}-${state.index}`}
        className="container px-8 pt-14 mx-auto h-[276px]"
      >
        <div className="relative">
          <div className="flex absolute top-0 left-0 justify-center w-full h-full">
            {state.prevIndex > -1 && (
              <CurvedCarouselItem
                title={prevItem.title}
                content={prevItem.content}
                href={prevItem.href}
                className="opacity-0 animate-curved-carousel-fadeout"
              />
            )}
          </div>
          <div className="flex absolute top-0 left-0 justify-center w-full h-full">
            <CurvedCarouselItem
              title={currItem.title}
              content={currItem.content}
              href={currItem.href}
              className="animate-curved-carousel-fadein"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

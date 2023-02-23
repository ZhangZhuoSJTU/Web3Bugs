import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useSwipeable } from 'react-swipeable'
import { IconButton } from '../../IconButton'

export type BasicCarouselItemsProps = { id: number | string; content: React.ReactNode }
export type BasicCarouselProps = {
  items: (activeIndex: number) => BasicCarouselItemsProps[] | BasicCarouselItemsProps[]
}

export const BasicCarousel: FC<BasicCarouselProps> = ({ items: itemsFunction }) => {
  const [index, setIndex] = useState(0)
  const items = typeof itemsFunction === 'function' ? itemsFunction(index) : itemsFunction
  const containerRef = useRef<HTMLDivElement>(null)

  // update disable state of buttons each time the slider is scrolled
  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const showCurrentItem = (): void => {
      const containerWidth = container.parentElement?.clientWidth ?? 0
      for (let i = 0; i < container.children.length; i++) {
        const cur = container.children[i] as HTMLDivElement
        cur.style.width = `${containerWidth}px`
      }
      container.style.transform = `translateX(-${containerWidth * index}px)`
      container.style.width = `${containerWidth * items.length}px`
    }

    window.addEventListener('resize', showCurrentItem)

    // initial check
    showCurrentItem()

    return (): void => {
      window.removeEventListener('resize', showCurrentItem)
    }
  }, [index, items])

  const prevDisabled = useMemo(() => index === 0, [index])
  const nextDisabled = useMemo(() => index >= items.length - 1, [index, items.length])

  const handlePrevClick = useCallback((): void => {
    if (!prevDisabled) setIndex((prev) => prev - 1)
  }, [prevDisabled])

  const handleNextClick = useCallback((): void => {
    if (!nextDisabled) setIndex((next) => next + 1)
  }, [nextDisabled])

  const handlers = useSwipeable({
    onSwipedRight: handlePrevClick,
    onSwipedLeft: handleNextClick,
    preventDefaultTouchmoveEvent: true,
  })

  return (
    <div className="flex items-center w-full">
      <div>
        <IconButton
          aria-label="Previous"
          onClick={handlePrevClick}
          disabled={prevDisabled}
          icon="chevronRightRound"
          className="w-5 h-5 bg-transparent rotate-180 sm:w-[30px] sm:h-[30px]"
          iconClass="w-full h-full"
        />
      </div>
      <div {...handlers} className="overflow-hidden relative grow py-2">
        <div
          ref={containerRef}
          className="flex relative transition-transform duration-300 ease-in-out"
        >
          {items.map(({ id, content }) => (
            <div key={id} className="box-content w-full pointer-events-auto snap-center">
              {content}
            </div>
          ))}
        </div>
      </div>
      <div>
        <IconButton
          aria-label="Next"
          onClick={handleNextClick}
          disabled={nextDisabled}
          icon="chevronRightRound"
          className="w-5 h-5 bg-transparent sm:w-[30px] sm:h-[30px]"
          iconClass="w-full h-full"
        />
      </div>
    </div>
  )
}

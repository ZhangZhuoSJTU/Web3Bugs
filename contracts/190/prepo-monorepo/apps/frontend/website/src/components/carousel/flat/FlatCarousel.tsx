import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useSwipeable } from 'react-swipeable'
import { FlatCarouselItem } from './FlatCarouselItem'
import { FlatCarouselItemData } from './FlatCarouselItemData'
import { IconButton } from '../../IconButton'

export type FlatCarouselProps = {
  items: FlatCarouselItemData[]
}

export const FlatCarousel: FC<FlatCarouselProps> = ({ items }) => {
  const [disablePrev, setDisablePrev] = useState(true)
  const [disableNext, setDisableNext] = useState(true)
  const [index, setIndex] = useState(() => items.findIndex((it) => it.current))

  // get a ref to the container so we can translate it programmatically
  const refContainer = useRef<HTMLDivElement>(null)

  // identify start index and gray out items before it
  const displayItems = useMemo(() => {
    const currentIndex = items.findIndex((it) => it.current)
    return items.map((item, i) => ({
      ...item,
      grayed: i < currentIndex,
    }))
  }, [items])

  // update disable state of buttons each time the slider is scrolled
  useEffect(() => {
    const container = refContainer.current
    if (!container) return undefined

    const showCurrentItem = (): void => {
      // breakpoint used to display 1 or 3 items
      const largeScreen = document.documentElement.clientWidth >= 1024

      // need to force an index change if resizing browser from small to large
      if (largeScreen && index === 0) {
        setIndex(1)
        return
      }
      if (largeScreen && index === items.length - 1) {
        setIndex(items.length - 2)
        return
      }

      const elemCurrent = container.children[index] as HTMLDivElement
      const margin = (container.clientWidth - elemCurrent.clientWidth) / 2
      container.style.transform = `translateX(${margin - elemCurrent.offsetLeft}px)`

      const shouldDisablePrev = index === (largeScreen ? 1 : 0)
      const shouldDisableNext = index === items.length - (largeScreen ? 2 : 1)

      if (shouldDisablePrev !== disablePrev) setDisablePrev(shouldDisablePrev)
      if (shouldDisableNext !== disableNext) setDisableNext(shouldDisableNext)
    }

    window.addEventListener('resize', showCurrentItem)

    // initial check
    showCurrentItem()

    return (): void => {
      window.removeEventListener('resize', showCurrentItem)
    }
  }, [disableNext, disablePrev, index, items])

  const handlePrevClick = useCallback((): void => setIndex((prev) => (prev > 0 ? prev - 1 : 0)), [])
  const handleNextClick = useCallback(
    (): void => setIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev)),
    [items]
  )

  const handlers = useSwipeable({
    onSwipedRight: handlePrevClick,
    onSwipedLeft: handleNextClick,
    preventDefaultTouchmoveEvent: true,
  })

  return (
    <div className="flex gap-[10px] w-full">
      <div className="pt-[15px] sm:pt-[18px]">
        <IconButton
          aria-label="Previous"
          onClick={handlePrevClick}
          disabled={disablePrev}
          icon="chevronRightRound"
          className="w-5 h-5 bg-transparent rotate-180 sm:w-[30px] sm:h-[30px]"
          iconClass="w-full h-full"
        />
      </div>
      <div {...handlers} className="overflow-hidden relative grow">
        <div className="absolute top-6 left-0 -z-10 w-full h-[2px] bg-[#5F61D2]/[19%] sm:top-8 sm:h-[3px]" />
        <div
          ref={refContainer}
          className="flex relative transition-transform duration-300 ease-in-out"
        >
          {displayItems.map(({ id, caption, title, icon, content, grayed, current }, i, arr) => (
            <div
              key={id}
              className={clsx(
                'box-content flex justify-center px-[calc((100%-250px)/4)] pointer-events-auto snap-center lg:px-[calc((100%-750px)/6)]',
                i === 0 && 'lg:pl-[calc(50%-125px)]', // more padding left for first item
                i === arr.length - 1 && 'lg:pr-[calc(50%-125px)]' // more padding right for last item
              )}
            >
              <FlatCarouselItem
                caption={caption}
                icon={icon}
                title={title}
                content={content}
                grayed={grayed}
                current={current}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="pt-[15px] sm:pt-[18px]">
        <IconButton
          aria-label="Next"
          onClick={handleNextClick}
          disabled={disableNext}
          icon="chevronRightRound"
          className="w-5 h-5 bg-transparent sm:w-[30px] sm:h-[30px]"
          iconClass="w-full h-full"
        />
      </div>
    </div>
  )
}

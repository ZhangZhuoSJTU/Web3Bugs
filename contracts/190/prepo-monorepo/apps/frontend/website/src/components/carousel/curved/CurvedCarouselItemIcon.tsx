import clsx from 'clsx'
import { FC, MouseEventHandler, useMemo } from 'react'
import { CurvedCarouselItemData } from './CurvedCarouselItemData'
import {
  CurvedCarouselAnimationDirection,
  CurvedCarouselIconPosition,
} from './CurvedCarouselShared'
import { Icon } from '../../Icon'

const getRotationClass = (
  currentPosition: CurvedCarouselIconPosition,
  direction?: CurvedCarouselAnimationDirection
): {
  element?: string
  icon?: string
} => {
  // We can't dynamically generate className as tailwind needs to parse each class
  // in source code files so they are added to the css bundle
  if (currentPosition === 'left' && direction === 'prev')
    return {
      element: 'animate-curved-carousel-left-prev',
      icon: 'animate-curved-carousel-icon-left-prev',
    }
  if (currentPosition === 'left' && direction === 'next')
    return {
      element: 'animate-curved-carousel-left-next',
      icon: 'animate-curved-carousel-icon-left-next',
    }

  if (currentPosition === 'center' && direction === 'prev')
    return {
      element: 'animate-curved-carousel-center-prev',
      icon: 'animate-curved-carousel-icon-center-prev',
    }
  if (currentPosition === 'center' && direction === 'next')
    return {
      element: 'animate-curved-carousel-center-next',
      icon: 'animate-curved-carousel-icon-center-next',
    }

  if (currentPosition === 'right' && direction === 'prev')
    return {
      element: 'animate-curved-carousel-right-prev',
      icon: 'animate-curved-carousel-icon-right-prev',
    }
  if (currentPosition === 'right' && direction === 'next')
    return {
      element: 'animate-curved-carousel-right-next',
      icon: 'animate-curved-carousel-icon-right-next',
    }

  if (currentPosition === 'out' && direction === 'prev')
    return {
      element: 'animate-curved-carousel-out-prev',
      icon: 'animate-curved-carousel-icon-out-prev',
    }
  if (currentPosition === 'out' && direction === 'next')
    return {
      element: 'animate-curved-carousel-out-next',
      icon: 'animate-curved-carousel-icon-out-next',
    }

  return {}
}

const getAnimatedIconClasses = (
  position: CurvedCarouselIconPosition,
  direction?: CurvedCarouselAnimationDirection
): {
  element?: string
  content?: string
  icon?: string
  text: string
} => {
  const classes = getRotationClass(position, direction)
  switch (position) {
    case 'center':
      return {
        element: clsx('rotate-[0deg]', classes.element),
        content: direction && (direction === 'next' ? 'rotate-[-45deg]' : 'rotate-[45deg]'),
        icon: clsx(
          'text-white bg-prepo',
          direction && (direction === 'next' ? 'rotate-[45deg]' : 'rotate-[-45deg]'),
          classes.icon
        ),
        text: clsx(
          'absolute top-3 opacity-0',
          direction === 'next' ? 'left-16' : 'right-16',
          direction && 'animate-curved-carousel-fadeout'
        ),
      }
    case 'left':
      return {
        element: clsx('rotate-[-45deg]', classes.element),
        content: 'rotate-[45deg]',
        icon: clsx(classes.icon, 'text-prepo bg-prepo-light/25'),
        text: clsx(
          'absolute top-3 right-16 opacity-100',
          direction === 'next' && 'animate-curved-carousel-fadein'
        ),
      }
    case 'right':
      return {
        element: clsx('rotate-[45deg]', classes.element),
        content: 'rotate-[-45deg]',
        icon: clsx('text-prepo bg-prepo-light/25', classes.icon),
        text: clsx(
          'absolute top-3 left-16 opacity-100',
          direction === 'prev' && 'animate-curved-carousel-fadein'
        ),
      }
    default:
      return {
        element: clsx('rotate-[180deg]', classes.element),
        content: direction === 'prev' ? 'rotate-[-45deg]' : 'rotate-[45deg]',
        icon: clsx('text-prepo bg-prepo-light/25', classes.icon),
        text: clsx('absolute top-3', direction === 'prev' ? 'left-16' : 'right-16'),
      }
  }
}

export const CurvedCarouselItemIcon: FC<{
  item: CurvedCarouselItemData
  position: CurvedCarouselIconPosition
  direction?: CurvedCarouselAnimationDirection
  onClick?: MouseEventHandler<HTMLDivElement>
}> = ({ item, position, direction, onClick }) => {
  // Multiple blocks are animated because when an icon is moving around the circle :
  // - the icon needs to change color if going to or from the center
  // - the icon must rotate to "counter" the parent block's rotation
  // - the text needs to rotate in a specific angle depending on the position
  // - the text must not appear for center element
  const classes = useMemo(() => getAnimatedIconClasses(position, direction), [position, direction])

  return (
    <div
      className={clsx(
        'absolute top-0 left-0 w-[525px] h-[525px] origin-[262.5px_285px] pointer-events-none sm:w-[1050px] sm:h-[1050px] sm:origin-[525px_549px]',
        classes.element
      )}
    >
      <div
        className={clsx(
          'absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto',
          classes.content,
          onClick && 'cursor-pointer'
        )}
        onClick={onClick}
        aria-hidden="true"
      >
        <div className="grid place-items-center w-12 h-12 bg-white rounded-full shadow-prepo-3 sm:shadow-prepo-4">
          <div className={clsx('grid place-items-center w-9 h-9 rounded-full', classes.icon)}>
            <Icon name={item.icon} className="w-5 h-5" />
          </div>
        </div>
        <h3 className={clsx('hidden text-lg font-bold text-title lg:inline-block', classes.text)}>
          {item.title}
        </h3>
      </div>
    </div>
  )
}

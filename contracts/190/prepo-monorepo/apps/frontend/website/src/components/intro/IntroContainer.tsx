import clsx from 'clsx'
import { DetailedHTMLProps, FC, HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react'
import { useIntersection } from 'react-use'
import { IntroContainerContext } from './IntroContainerContext'

const OPTIONS: IntersectionObserverInit = {
  root: null,
  // values that trigger a state update
  threshold: [
    0, 0, 0.5, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
    0.85, 0.9, 0.95, 1,
  ],
}

type Props = { maxScreenRatio?: number } & DetailedHTMLProps<
  HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>

export const IntroContainer: FC<Props> = ({
  maxScreenRatio = 1,
  children,
  className,
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const observer = useIntersection(ref, OPTIONS)
  const [visibilityRatio, setVisibilityRatio] = useState(0)

  useEffect(() => {
    if (!observer) return
    const container = ref.current as HTMLDivElement

    const newVisibilityRatio = Math.min(
      1,
      container.clientHeight > window.innerHeight
        ? observer.intersectionRect.height / (window.innerHeight * 0.6)
        : observer.intersectionRatio / (maxScreenRatio * 0.95) // 0.95 to compensate for the 0.02 degree rotation which prevents to reach 1
    )

    // Once intro is completed, freeze the visbilityRatio
    setVisibilityRatio((prev) => (prev === 1 ? 1 : newVisibilityRatio))
  }, [maxScreenRatio, observer])

  const value = useMemo(() => ({ visibilityRatio }), [visibilityRatio])

  return (
    // visible overflow breaks firefox animations
    // also adding a negligeable rotation fixes firefox performance issues
    // https://stackoverflow.com/questions/62143105/react-spring-and-framer-motion-laggy-on-firefox
    <div ref={ref} className={clsx('overflow-hidden rotate-[0.02deg]', className)} {...props}>
      <IntroContainerContext.Provider value={value}>{children}</IntroContainerContext.Provider>
    </div>
  )
}

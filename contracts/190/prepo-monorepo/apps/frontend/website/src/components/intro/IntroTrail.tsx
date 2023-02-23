import { Children, useContext, useMemo } from 'react'
import { useTrail, animated, UseTrailProps, config } from 'react-spring'
import { IntroContainerContext } from './IntroContainerContext'

type Props = {
  componentClassName?: string
  keys: string[]
  trailProps?: UseTrailProps
  appearAt?: number // min visibilityRatio value for the trail to start
}

const defaultTrailProps: UseTrailProps = {
  config: config.wobbly,
  transform: 'scale(1)',
  from: { transform: 'scale(0.01)' },
}

export const IntroTrail: React.FC<Props> = ({
  children,
  componentClassName,
  keys,
  appearAt = 1,
  trailProps = defaultTrailProps,
}) => {
  const { visibilityRatio } = useContext(IntroContainerContext)

  const show = useMemo(() => visibilityRatio >= appearAt, [visibilityRatio, appearAt])

  const trailElements = useMemo(() => Children.toArray(children), [children])

  const trail = useTrail(trailElements.length, {
    from: { opacity: 0, ...(trailProps?.from || {}) },
    opacity: show ? 1 : 0,
    ...(show ? trailProps : {}),
  })

  return (
    <>
      {trail.map((style, index) => (
        <animated.div key={keys[index]} style={style} className={componentClassName}>
          {trailElements[index]}
        </animated.div>
      ))}
    </>
  )
}

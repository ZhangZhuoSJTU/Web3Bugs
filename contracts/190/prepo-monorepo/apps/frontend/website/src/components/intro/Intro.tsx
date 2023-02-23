import { FC, useContext, useEffect, useMemo } from 'react'
import {
  animated,
  ControllerUpdate,
  useSpring,
  UseSpringProps,
  config,
  UnknownProps,
} from 'react-spring'
import { IntroContainerContext } from './IntroContainerContext'

type IntroType = 'fadeIn' | 'fadeInUp' | 'fadeInLTR' | 'slideUp'

type Preset<T extends object = UnknownProps> = {
  springInit: UseSpringProps<T>
  springUpdate: (visibilityRatio: number) => ControllerUpdate<T>
}

const presets: Record<IntroType, Preset> = {
  fadeIn: {
    springInit: { config: config.default, from: { opacity: 0 } },
    springUpdate: (visibilityRatio) => ({
      to: { opacity: Math.round(100 * visibilityRatio) / 100 },
    }),
  },
  fadeInUp: {
    springInit: { config: config.default, from: { opacity: 0, transform: 'translateY(100vh)' } },
    springUpdate: (visibilityRatio) => ({
      to: {
        opacity: visibilityRatio,
        transform: `translateY(${Math.round(100 - visibilityRatio * 100)}vh)`,
      },
    }),
  },
  fadeInLTR: {
    springInit: { config: config.default, from: { opacity: 0, transform: 'translateX(-100%)' } },
    springUpdate: (visibilityRatio) => ({
      to: {
        opacity: visibilityRatio,
        transform: `translateX(${Math.round(-100 + visibilityRatio * 100)}%)`,
      },
    }),
  },
  slideUp: {
    springInit: { config: config.default, from: { transform: 'translateY(100%)' } },
    springUpdate: (visibilityRatio) => ({
      to: { transform: `translateY(${Math.round(100 - visibilityRatio * 100)}%)` },
    }),
  },
}

type IntroProps = {
  type?: IntroType
  className?: string
}

/*
  This component outputs a div, it can be tagged inline using className="inline"
  Note : couldn't make the tag (div) dynamic using JSX.IntrinsicElements because of the ref
*/
export const Intro: FC<IntroProps> = ({ type = 'fadeIn', className, children }) => {
  const { springInit, springUpdate } = useMemo(() => presets[type], [type])
  const { visibilityRatio } = useContext(IntroContainerContext)

  const [styles, api] = useSpring(() => springInit, [springInit])

  useEffect(() => {
    api.start(springUpdate(visibilityRatio))
  }, [api, visibilityRatio, type, springUpdate])

  return (
    <animated.div className={className} style={styles}>
      {children}
    </animated.div>
  )
}

import { FC, useCallback, useMemo, useState } from 'react'
import { animated, useSpring, UseSpringProps } from 'react-spring'
import { easeCubicInOut } from 'd3-ease'
import { HeroCircleInner } from './HeroCircleInner'
import { HeroCircleOuter } from './HeroCircleOuter'
import { HeroInnerElements1, HeroInnerElements1Defs } from './HeroInnerElements1'
import { HeroInnerElements2, HeroInnerElements2Defs } from './HeroInnerElements2'
import { HeroOuterElements1, HeroOuterElements1Defs } from './HeroOuterElements1'
import { HeroOuterElements2, HeroOuterElements2Defs } from './HeroOuterElements2'

export const CENTER_X = 720.257
export const CENTER_Y = 328.047

export const INNER_1_X = 138.5
export const TRANSLATE_INNER_1 = `translate(${INNER_1_X}, 0)`
export const INNER_CIRCLE_ORIGIN_1 = `${CENTER_X - INNER_1_X}px ${CENTER_Y}px`

export const INNER_2_X = 40
export const TRANSLATE_INNER_2 = `translate(${INNER_2_X}, 0)`
export const INNER_CIRCLE_ORIGIN_2 = `${CENTER_X - INNER_2_X}px ${CENTER_Y}px`

// fixma fix
export const OUTER_2_X = -20
export const TRANSLATE_OUTER_2 = `translate(${OUTER_2_X}, 0)`
export const OUTER_CIRCLE_ORIGIN_2 = `${CENTER_X - OUTER_2_X}px ${CENTER_Y}px`

const ANIM_DURATION = 3000
const ANIM_DELAY_BETWEEN = 2000

export const HeroAnimation: FC = () => {
  const [flip, setFlip] = useState(false)

  const animCommonProps: UseSpringProps = useMemo(
    () => ({
      reset: true,
      reverse: flip,
      config: {
        duration: ANIM_DURATION,
        easing: easeCubicInOut,
      },
    }),
    [flip]
  )

  const handleRest = useCallback(
    () => setTimeout(() => setFlip(!flip), flip ? 0 : ANIM_DELAY_BETWEEN),
    [flip]
  )
  const { outerDelay, innerDelay } = useMemo(
    () => ({
      outerDelay: flip ? 0 : ANIM_DELAY_BETWEEN * 2 + ANIM_DURATION,
      innerDelay: flip ? 0 : ANIM_DELAY_BETWEEN,
    }),
    [flip]
  )

  const animOuter1 = useSpring({
    ...animCommonProps,
    from: { rotateZ: 0 },
    to: { rotateZ: -90 },
    delay: outerDelay,
  })
  const animOuter2 = useSpring({
    ...animCommonProps,
    from: { rotateZ: 90 },
    to: { rotateZ: 0 },
    delay: outerDelay,
    onRest: handleRest,
  })
  const animInner1 = useSpring({
    ...animCommonProps,
    from: { rotateZ: 0 },
    to: { rotateZ: 90 },
    delay: innerDelay,
  })
  const animInner2 = useSpring({
    ...animCommonProps,
    from: { rotateZ: -90 },
    to: { rotateZ: 0 },
    delay: innerDelay,
  })

  // Rerenders only when flip value changes, as intended
  return (
    <svg
      width="1440"
      height="619"
      viewBox="0 0 1440 619"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className="animate-fadein"
    >
      <HeroCircleOuter />
      <HeroCircleInner />
      <animated.g
        style={{
          transformOrigin: OUTER_CIRCLE_ORIGIN_2,
          ...animOuter1,
        }}
      >
        <HeroOuterElements1 />
      </animated.g>
      <g transform={TRANSLATE_OUTER_2}>
        <animated.g
          style={{
            transformOrigin: OUTER_CIRCLE_ORIGIN_2,
            ...animOuter2,
          }}
        >
          <HeroOuterElements2 />
        </animated.g>
      </g>
      <g transform={TRANSLATE_INNER_1}>
        <animated.g
          style={{
            transformOrigin: INNER_CIRCLE_ORIGIN_1,
            ...animInner1,
          }}
        >
          <HeroInnerElements1 />
        </animated.g>
      </g>
      <g transform={TRANSLATE_INNER_2}>
        <animated.g
          style={{
            transformOrigin: INNER_CIRCLE_ORIGIN_2,
            ...animInner2,
          }}
        >
          <HeroInnerElements2 />
        </animated.g>
      </g>
      <defs>
        <HeroOuterElements1Defs />
        <HeroOuterElements2Defs />
        <HeroInnerElements1Defs />
        <HeroInnerElements2Defs />
      </defs>
    </svg>
  )
}

export default HeroAnimation

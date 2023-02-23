/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useState, useEffect } from 'react'
import throttle from 'lodash.throttle'
import { Sizes, sizes } from '../features/app/themes'

const getDeviceConfig = (width: number): keyof Sizes => {
  if (width < sizes.lg) {
    return 'md'
  }

  return 'lg'
}

const useBreakpoint = (): keyof Sizes => {
  const [breakPoint, setBreakPoint] = useState<keyof Sizes>(() =>
    getDeviceConfig(window.innerWidth)
  )

  useEffect(() => {
    // @ts-ignore
    const calcInnerWidth = throttle(() => {
      setBreakPoint(getDeviceConfig(window.innerWidth))
    }, 200)

    window.addEventListener('resize', calcInnerWidth)
    return () => window.removeEventListener('resize', calcInnerWidth)
  }, [])

  return breakPoint
}
export default useBreakpoint

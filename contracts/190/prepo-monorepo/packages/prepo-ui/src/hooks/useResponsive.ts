import { useMemo } from 'react'
import { useWindowSize } from './useWindowSize'
import { Sizes } from '../common-utils'

export type Responsive = {
  isDesktop: boolean
  isPhone: boolean
  isTablet: boolean
}

const useResponsive = (): Responsive => {
  const { width } = useWindowSize()

  const definedWidth = width || 0
  return useMemo(
    () => ({
      isDesktop: definedWidth > Sizes.desktop,
      isPhone: definedWidth <= Sizes.tablet,
      isTablet: definedWidth <= Sizes.desktop && definedWidth > Sizes.tablet,
    }),
    [definedWidth]
  )
}

export default useResponsive

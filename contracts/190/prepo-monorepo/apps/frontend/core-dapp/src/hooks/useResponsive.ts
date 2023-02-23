import { useMemo } from 'react'
import { Sizes } from 'prepo-ui'
import { useWindowSize } from './useWindowSize'

export type Responsive = {
  isLargeDesktop: boolean
  isDesktop: boolean
  isPhone: boolean
  isTablet: boolean
}

const useResponsive = (): Responsive => {
  const { width } = useWindowSize()

  const definedWidth = width || 0
  return useMemo(
    () => ({
      isLargeDesktop: definedWidth > Sizes.largeDesktop,
      isDesktop: definedWidth > Sizes.desktop,
      isPhone: definedWidth <= Sizes.tablet,
      isTablet: definedWidth <= Sizes.desktop && definedWidth > Sizes.tablet,
    }),
    [definedWidth]
  )
}

export default useResponsive

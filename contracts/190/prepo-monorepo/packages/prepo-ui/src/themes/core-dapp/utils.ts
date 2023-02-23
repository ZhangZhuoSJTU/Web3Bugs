import { css } from 'styled-components'
import { ONE_REM_PX } from '../../common-utils'
import { media } from '../../common-utils/media'

export const TRANSPARENT = 'transparent'

export const spacingIncrement = (figmaPoint: number): string => {
  const value = figmaPoint / ONE_REM_PX
  return `${value}rem`
}

export const roundedBorder = css`
  border: 1px solid ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({ theme }): string => theme.borderRadius.base};
`

export const centered = css`
  align-items: center;
  display: flex;
  justify-content: center;
`

export const showOnDesktopOnly = css`
  display: none;
  ${media.desktop`
    display: block;
  `}
`

export const hideOnDesktopOnly = css`
  display: block;
  ${media.desktop`
    display: none;
  `}
`

export const primaryFontFamily = css`
  font-family: ${({ theme }): string => theme.fontFamily.primary};
`

export const secondaryFontFamily = css`
  font-family: ${({ theme }): string => theme.fontFamily.secondary};
`

export const removeUserSelect = css`
  -khtml-user-select: none; /* iOS Safari */
  -moz-user-select: none; /* Safari */
  -ms-user-select: none; /* Konqueror HTML */
  -webkit-touch-callout: none; /* Old versions of Firefox */
  -webkit-user-select: none; /* Internet Explorer/Edge */
  user-select: none; /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
`

export function responsiveAdapter<T>({
  phone,
  tablet,
  desktop,
  largeDesktop,
}: {
  phone?: T
  tablet?: T
  desktop?: T
  largeDesktop?: T
}): [T, T, T, T] {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return [phone, tablet, desktop, largeDesktop]
}

import { css } from 'styled-components'
import { ONE_REM_PX } from './general-settings'

export const spacingIncrement = (figmaPoint: number): string => {
  const value = figmaPoint / ONE_REM_PX
  return `${value}rem`
}

export const centered = css`
  align-items: center;
  display: flex;
  justify-content: center;
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

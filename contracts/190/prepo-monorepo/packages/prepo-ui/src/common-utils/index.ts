import { css } from 'styled-components'

export { media } from './media'
export { pixelSizes, Sizes } from './breakpoints'

export const ONE_REM_PX = 16

export const spacingIncrement = (figmaPoint: number): string => {
  const value = figmaPoint / ONE_REM_PX
  return `${value}rem`
}

export const centered = css`
  align-items: center;
  display: flex;
  justify-content: center;
`

export const absoluteCenterY = css`
  top: 50%;
  transform: translateY(-50%);
`

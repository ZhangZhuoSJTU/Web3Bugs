/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { css, DefaultTheme, ThemedCssFunction } from 'styled-components'
import { sizes } from '../features/app/themes'

export const pixelSizes = {
  lg: `${sizes.lg}px`,
  md: `${sizes.md}px`,
}

type Media = {
  lg: ThemedCssFunction<DefaultTheme>
  md: ThemedCssFunction<DefaultTheme>
}

export const media: Media = Object.keys(sizes).reduce((acc: any, label) => {
  acc[label] = (...args: TemplateStringsArray): any => css`
    @media (max-width: ${sizes[label as keyof Sizes] / 16}em) {
      ${css.call(undefined, ...args)};
    }
  `

  return acc
}, {})

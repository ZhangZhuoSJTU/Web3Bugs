// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { css, DefaultTheme, ThemedCssFunction } from 'styled-components'
import { Sizes, pixelSizes } from './breakpoints'

type Media = {
  [K in keyof typeof pixelSizes]: ThemedCssFunction<DefaultTheme>
}

export const media: Media = Object.keys(Sizes).reduce((acc: any, label) => {
  acc[label] = (...args: TemplateStringsArray): any => css`
    @media (min-width: ${(Sizes as any)[label as keyof Sizes] / 16}em) {
      ${css.call(undefined, ...args)};
    }
  `
  return acc
}, {})

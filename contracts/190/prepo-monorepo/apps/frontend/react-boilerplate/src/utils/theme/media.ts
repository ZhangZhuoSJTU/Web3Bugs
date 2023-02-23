/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { css, DefaultTheme, ThemedCssFunction } from 'styled-components'
import { sizes } from './breakpoints'

type Media = {
  desktop: ThemedCssFunction<DefaultTheme>
  tablet: ThemedCssFunction<DefaultTheme>
  phone: ThemedCssFunction<DefaultTheme>
}

export const media: Media = Object.keys(sizes).reduce((acc: any, label) => {
  acc[label] = (...args: TemplateStringsArray): any => css`
    @media (min-width: ${sizes[label as keyof Sizes] / 16}em) {
      ${css.call(undefined, ...args)};
    }
  `

  return acc
}, {})

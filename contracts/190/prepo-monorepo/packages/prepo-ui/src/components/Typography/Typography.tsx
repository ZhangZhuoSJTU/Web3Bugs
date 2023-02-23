/* eslint-disable @typescript-eslint/no-explicit-any */
import styled, { DefaultTheme } from 'styled-components'
import { variant, typography, TypographyProps } from 'styled-system'
import { BreakpontObjectType, responsiveAdapter } from '../../themes/core-dapp'
import Box from '../Box'

export const TEXT_TYPE_ARRAY = [
  'text-regular-sm',
  'text-regular-base',
  'text-regular-md',
  'text-regular-lg',
  'text-regular-xl',
  'text-regular-2xl',
  'text-regular-3xl',
  'text-regular-4xl',
  'text-medium-sm',
  'text-medium-base',
  'text-medium-md',
  'text-medium-lg',
  'text-medium-xl',
  'text-medium-2xl',
  'text-medium-3xl',
  'text-medium-4xl',
  'text-semiBold-sm',
  'text-semiBold-base',
  'text-semiBold-md',
  'text-semiBold-lg',
  'text-semiBold-xl',
  'text-semiBold-2xl',
  'text-semiBold-3xl',
  'text-semiBold-4xl',
  'text-bold-sm',
  'text-bold-base',
  'text-bold-md',
  'text-bold-lg',
  'text-bold-xl',
  'text-bold-2xl',
  'text-bold-3xl',
  'text-bold-4xl',
  'text-extraBold-sm',
  'text-extraBold-base',
  'text-extraBold-md',
  'text-extraBold-lg',
  'text-extraBold-xl',
  'text-extraBold-2xl',
  'text-extraBold-3xl',
  'text-extraBold-4xl',
] as const
type TextTypes = typeof TEXT_TYPE_ARRAY[number]

type Varaints = { variant: TextTypes }

type StyleObjectType = {
  fontSize: string | Partial<BreakpontObjectType>
  fontWeight: number
}

type StyleArrayType = {
  fontSize: string | string[]
  fontWeight: number
}

const variants = (theme: DefaultTheme): Record<TextTypes, StyleObjectType> => ({
  'text-regular-sm': {
    fontSize: { phone: theme.fontSize['2xs'], desktop: theme.fontSize.sm },
    fontWeight: theme.fontWeight.regular,
  },
  'text-regular-base': {
    fontSize: { phone: theme.fontSize.xs, desktop: theme.fontSize.base },
    fontWeight: theme.fontWeight.regular,
  },
  'text-regular-md': {
    fontSize: { phone: theme.fontSize.sm, desktop: theme.fontSize.md },
    fontWeight: theme.fontWeight.regular,
  },
  'text-regular-lg': {
    fontSize: { phone: theme.fontSize.base, desktop: theme.fontSize.lg },
    fontWeight: theme.fontWeight.regular,
  },
  'text-regular-xl': {
    fontSize: { phone: theme.fontSize.md, desktop: theme.fontSize.xl },
    fontWeight: theme.fontWeight.regular,
  },
  'text-regular-2xl': {
    fontSize: { phone: theme.fontSize.lg, desktop: theme.fontSize['2xl'] },
    fontWeight: theme.fontWeight.regular,
  },
  'text-regular-3xl': {
    fontSize: { phone: theme.fontSize.xl, desktop: theme.fontSize['3xl'] },
    fontWeight: theme.fontWeight.regular,
  },
  'text-regular-4xl': {
    fontSize: { phone: theme.fontSize['2xl'], desktop: theme.fontSize['4xl'] },
    fontWeight: theme.fontWeight.regular,
  },
  'text-medium-sm': {
    fontSize: { phone: theme.fontSize['2xs'], desktop: theme.fontSize.sm },
    fontWeight: theme.fontWeight.medium,
  },
  'text-medium-base': {
    fontSize: { phone: theme.fontSize.xs, desktop: theme.fontSize.base },
    fontWeight: theme.fontWeight.medium,
  },
  'text-medium-md': {
    fontSize: { phone: theme.fontSize.sm, desktop: theme.fontSize.md },
    fontWeight: theme.fontWeight.medium,
  },
  'text-medium-lg': {
    fontSize: { phone: theme.fontSize.base, desktop: theme.fontSize.lg },
    fontWeight: theme.fontWeight.medium,
  },
  'text-medium-xl': {
    fontSize: { phone: theme.fontSize.md, desktop: theme.fontSize.xl },
    fontWeight: theme.fontWeight.medium,
  },
  'text-medium-2xl': {
    fontSize: { phone: theme.fontSize.lg, desktop: theme.fontSize['2xl'] },
    fontWeight: theme.fontWeight.medium,
  },
  'text-medium-3xl': {
    fontSize: { phone: theme.fontSize.xl, desktop: theme.fontSize['3xl'] },
    fontWeight: theme.fontWeight.medium,
  },
  'text-medium-4xl': {
    fontSize: { phone: theme.fontSize['2xl'], desktop: theme.fontSize['4xl'] },
    fontWeight: theme.fontWeight.medium,
  },
  'text-semiBold-sm': {
    fontSize: { phone: theme.fontSize['2xs'], desktop: theme.fontSize.sm },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-semiBold-base': {
    fontSize: { phone: theme.fontSize.xs, desktop: theme.fontSize.base },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-semiBold-md': {
    fontSize: { phone: theme.fontSize.sm, desktop: theme.fontSize.md },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-semiBold-lg': {
    fontSize: { phone: theme.fontSize.base, desktop: theme.fontSize.lg },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-semiBold-xl': {
    fontSize: { phone: theme.fontSize.md, desktop: theme.fontSize.xl },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-semiBold-2xl': {
    fontSize: { phone: theme.fontSize.lg, desktop: theme.fontSize['2xl'] },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-semiBold-3xl': {
    fontSize: { phone: theme.fontSize.xl, desktop: theme.fontSize['3xl'] },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-semiBold-4xl': {
    fontSize: { phone: theme.fontSize['2xl'], desktop: theme.fontSize['4xl'] },
    fontWeight: theme.fontWeight.semiBold,
  },
  'text-bold-sm': {
    fontSize: { phone: theme.fontSize['2xs'], desktop: theme.fontSize.sm },
    fontWeight: theme.fontWeight.bold,
  },
  'text-bold-base': {
    fontSize: { phone: theme.fontSize.xs, desktop: theme.fontSize.base },
    fontWeight: theme.fontWeight.bold,
  },
  'text-bold-md': {
    fontSize: { phone: theme.fontSize.sm, desktop: theme.fontSize.md },
    fontWeight: theme.fontWeight.bold,
  },
  'text-bold-lg': {
    fontSize: { phone: theme.fontSize.base, desktop: theme.fontSize.lg },
    fontWeight: theme.fontWeight.bold,
  },
  'text-bold-xl': {
    fontSize: { phone: theme.fontSize.md, desktop: theme.fontSize.xl },
    fontWeight: theme.fontWeight.bold,
  },
  'text-bold-2xl': {
    fontSize: { phone: theme.fontSize.lg, desktop: theme.fontSize['2xl'] },
    fontWeight: theme.fontWeight.bold,
  },
  'text-bold-3xl': {
    fontSize: { phone: theme.fontSize.xl, desktop: theme.fontSize['3xl'] },
    fontWeight: theme.fontWeight.bold,
  },
  'text-bold-4xl': {
    fontSize: { phone: theme.fontSize['2xl'], desktop: theme.fontSize['4xl'] },
    fontWeight: theme.fontWeight.bold,
  },
  'text-extraBold-sm': {
    fontSize: { phone: theme.fontSize['2xs'], desktop: theme.fontSize.sm },
    fontWeight: theme.fontWeight.extraBold,
  },
  'text-extraBold-base': {
    fontSize: { phone: theme.fontSize.xs, desktop: theme.fontSize.base },
    fontWeight: theme.fontWeight.extraBold,
  },
  'text-extraBold-md': {
    fontSize: { phone: theme.fontSize.sm, desktop: theme.fontSize.md },
    fontWeight: theme.fontWeight.extraBold,
  },
  'text-extraBold-lg': {
    fontSize: { phone: theme.fontSize.base, desktop: theme.fontSize.lg },
    fontWeight: theme.fontWeight.extraBold,
  },
  'text-extraBold-xl': {
    fontSize: { phone: theme.fontSize.md, desktop: theme.fontSize.xl },
    fontWeight: theme.fontWeight.extraBold,
  },
  'text-extraBold-2xl': {
    fontSize: { phone: theme.fontSize.lg, desktop: theme.fontSize['2xl'] },
    fontWeight: theme.fontWeight.extraBold,
  },
  'text-extraBold-3xl': {
    fontSize: { phone: theme.fontSize.xl, desktop: theme.fontSize['3xl'] },
    fontWeight: theme.fontWeight.extraBold,
  },
  'text-extraBold-4xl': {
    fontSize: { phone: theme.fontSize['2xl'], desktop: theme.fontSize['4xl'] },
    fontWeight: theme.fontWeight.extraBold,
  },
})

const transform = (
  target: Record<TextTypes, StyleObjectType>
): Record<TextTypes, StyleArrayType> => {
  const result = {} as any
  Object.keys(target).forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const style = target[key]
    result[key] = {}
    Object.keys(style).forEach((styleKey) => {
      const value = style[styleKey]
      result[key][styleKey] = typeof value === 'object' ? responsiveAdapter(value) : value
    })
  })
  return result
}

const Typography = styled(Box)<TypographyProps & Varaints>`
  ${({ theme }): any =>
    variant({
      variants: transform(variants(theme)),
    })}
  ${typography}
`
// formula from https://kittygiraudel.com/2020/05/18/using-calc-to-figure-out-optimal-line-height/
Typography.defaultProps = {
  lineHeight: 'calc(2px + 2ex + 2px);',
}

export default Typography

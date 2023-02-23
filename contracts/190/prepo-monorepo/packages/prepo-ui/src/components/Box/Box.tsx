import styled, { Color } from 'styled-components'
import {
  color,
  layout,
  LayoutProps,
  ColorProps,
  space,
  position,
  PositionProps,
  SpaceProps,
  border,
  display,
  DisplayProps,
  BorderProps,
  shadow,
  ShadowProps,
  system,
  FlexboxProps,
  flexbox,
} from 'styled-system'
import { spacingIncrement } from '../../common-utils'

type ValueType = string | number | undefined | null
export type GapProps = {
  gap?:
    | ValueType
    | ValueType[]
    | { phone?: ValueType; desktop?: ValueType; tablet?: ValueType; largeDesktop?: ValueType }
}

type FilterProps = {
  filter?: string
}

export type BoxProps = LayoutProps &
  ColorProps &
  SpaceProps &
  BorderProps &
  ShadowProps &
  PositionProps &
  FlexboxProps &
  GapProps &
  FilterProps &
  DisplayProps & {
    color?: keyof Color
    bg?: keyof Color
    background?: keyof Color
    borderColor?: keyof Color
    borderTopColor?: keyof Color
    borderBottomColor?: keyof Color
    borderLeftColor?: keyof Color
    borderRightColor?: keyof Color
  }

/** transform function applies spacingIncrement to all number type */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transform = (value: any): any => (typeof value === 'number' ? spacingIncrement(value) : value)

/** base building block, color type use scale to get value from theme */
const Box = styled.div<BoxProps>`
  ${space}
  ${color}
  ${display}
  ${shadow}
  ${border}
  ${flexbox}
  ${layout}
  ${position}
  ${system({
    fontSize: {
      property: 'fontSize',
      transform,
    },
    mt: {
      property: 'marginTop',
      transform,
    },
    mb: {
      property: 'marginBottom',
      transform,
    },
    my: {
      properties: ['marginBottom', 'marginTop'],
      transform,
    },
    mr: {
      property: 'marginRight',
      transform,
    },
    ml: {
      property: 'marginLeft',
      transform,
    },
    mx: {
      properties: ['marginLeft', 'marginRight'],
      transform,
    },
    m: {
      property: 'margin',
      transform,
    },
    marginTop: {
      property: 'marginTop',
      transform,
    },
    marginBottom: {
      property: 'marginBottom',
      transform,
    },
    marginRight: {
      property: 'marginRight',
      transform,
    },
    marginLeft: {
      property: 'marginLeft',
      transform,
    },
    margin: {
      property: 'margin',
      transform,
    },
    marginY: {
      properties: ['marginBottom', 'marginTop'],
      transform,
    },
    marginX: {
      properties: ['marginLeft', 'marginRight'],
      transform,
    },
    pt: {
      property: 'paddingTop',
      transform,
    },
    pb: {
      property: 'paddingBottom',
      transform,
    },
    py: {
      properties: ['paddingBottom', 'paddingTop'],
      transform,
    },
    pr: {
      property: 'paddingRight',
      transform,
    },
    pl: {
      property: 'paddingLeft',
      transform,
    },
    px: {
      properties: ['paddingLeft', 'paddingRight'],
      transform,
    },
    p: {
      property: 'padding',
      transform,
    },
    paddingTop: {
      property: 'paddingTop',
      transform,
    },
    paddingBottom: {
      property: 'paddingBottom',
      transform,
    },
    paddingY: {
      properties: ['paddingBottom', 'paddingTop'],
      transform,
    },
    paddingRight: {
      property: 'paddingRight',
      transform,
    },
    paddingLeft: {
      property: 'paddingLeft',
      transform,
    },
    paddingX: {
      properties: ['paddingLeft', 'paddingRight'],
      transform,
    },
    padding: {
      property: 'padding',
      transform,
    },
    height: {
      property: 'height',
      transform,
    },
    maxHeight: {
      property: 'maxHeight',
      transform,
    },
    minHeight: {
      property: 'minHeight',
      transform,
    },
    maxWidth: {
      property: 'maxWidth',
      transform,
    },
    minWidth: {
      property: 'minWidth',
      transform,
    },
    width: {
      property: 'width',
      transform,
    },
    background: {
      property: 'background',
      scale: 'color',
    },
    bg: {
      property: 'background',
      scale: 'color',
    },
    color: {
      property: 'color',
      scale: 'color',
    },
    borderColor: {
      property: 'borderColor',
      scale: 'color',
    },
    borderTopColor: {
      property: 'borderTopColor',
      scale: 'color',
    },
    borderBottomColor: {
      property: 'borderBottomColor',
      scale: 'color',
    },
    borderLeftColor: {
      property: 'borderLeftColor',
      scale: 'color',
    },
    borderRightColor: {
      property: 'borderRightColor',
      scale: 'color',
    },
    gap: {
      property: 'gap',
      transform,
    },
    filter: {
      property: 'filter',
    },
  })}
`

export default Box

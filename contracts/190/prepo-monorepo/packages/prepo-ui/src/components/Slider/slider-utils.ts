import { css, SimpleInterpolation } from 'styled-components'
import { Thickness } from './Slider'
import { media, spacingIncrement } from '../../common-utils'

export function getColoredTrackPercentages(
  min: number,
  max: number,
  entry: number,
  exit: number
): [number, number] {
  const d = max - min
  const start = (Math.min(entry, exit) - min) / d
  const end = (max - Math.max(entry, exit)) / d
  return [Number((start * 100).toFixed(1)), Number((end * 100).toFixed(1))]
}

export function getResponsiveHeight(thickness: Thickness = 'normal'): SimpleInterpolation {
  return css`
    height: ${thickness === 'small' ? spacingIncrement(4) : spacingIncrement(8)};
    ${media.desktop`
      height: ${thickness === 'small' ? spacingIncrement(9) : spacingIncrement(13)};
  `}
  `
}

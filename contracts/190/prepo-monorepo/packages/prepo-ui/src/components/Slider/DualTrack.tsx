import styled, { Color, SimpleInterpolation } from 'styled-components'
import { Thickness, ThumbStyle } from './Slider'
import { sliderTrackBorderRadius } from './slider-settings'
import { getResponsiveHeight } from './slider-utils'

type Props = {
  trackColor: keyof Color
  trackUnderlyingColor: keyof Color
  index: number
  coloredTrackLeftPercent: number
  coloredTrackRightPercent: number
  thickness?: Thickness
  thumbStyles: [ThumbStyle, ThumbStyle]
}

// Set frequently changed props via .attrs to improve performance
const DualTrack = styled.div.attrs(
  ({ index, coloredTrackLeftPercent, coloredTrackRightPercent }: Props) => {
    if (index === 1) {
      return {
        style: {
          left: `${coloredTrackLeftPercent}px`,
          right: `${coloredTrackRightPercent}px`,
        },
      }
    }
    return {}
  }
)<Props>`
  background-color: ${({ trackUnderlyingColor, theme }): string =>
    theme.color[trackUnderlyingColor]};
  ${({ thickness }): SimpleInterpolation => getResponsiveHeight(thickness)}

  ${({ index, theme, trackColor }): string => {
    // First track always has a thumb on the right side
    if (index === 0)
      return `border-radius: ${sliderTrackBorderRadius} 0 0 ${sliderTrackBorderRadius};`
    // 3rd track always has a thumb on the left side
    if (index === 2)
      return `border-radius: 0 ${sliderTrackBorderRadius} ${sliderTrackBorderRadius} 0;`

    // Selected portion of the track
    if (index === 1) {
      return `
        z-index: 1;
        border-radius: 0;
        background-color: ${theme.color[trackColor]};
      `
    }

    return ''
  }}
`

export default DualTrack

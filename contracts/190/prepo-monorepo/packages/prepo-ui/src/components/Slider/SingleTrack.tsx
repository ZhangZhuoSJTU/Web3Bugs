import styled, { Color, SimpleInterpolation } from 'styled-components'
import { Thickness } from './Slider'
import { SLIDER_DEFAULT_SETTINGS, sliderTrackBorderRadius } from './slider-settings'
import { getResponsiveHeight } from './slider-utils'

type Props = {
  trackColor: keyof Color
  trackUnderlyingColor?: keyof Color
  index: number
  thickness: Thickness
}

const Wrapper = styled.div<Props>`
  border-radius: ${sliderTrackBorderRadius};
  ${({ thickness }): SimpleInterpolation => getResponsiveHeight(thickness)}
  ${({ index, theme, trackColor, trackUnderlyingColor }): string => {
    if (index === 0) {
      return `background-color: ${theme.color[trackColor]};`
    }

    return `
      background-color: ${
        trackUnderlyingColor
          ? theme.color[trackUnderlyingColor]
          : SLIDER_DEFAULT_SETTINGS.trackUnderlyingColor
      };
    `
  }}
`

const SingleSliderTrack: React.FC<Props> = ({ index, thickness, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Wrapper index={index} thickness={thickness} {...props} />
)

export default SingleSliderTrack

import styled from 'styled-components'
import { SupportedColor, trackColorToThemeColor } from './slider-utils'

type Props = {
  trackColor: SupportedColor
  index: number
  coloredTrackLeftPercent: number
  coloredTrackRightPercent: number
}

// Set frequently changed props via .attrs to improve performance
const SliderTrack = styled.div.attrs(
  ({ index, coloredTrackLeftPercent, coloredTrackRightPercent }: Props) => {
    if (index === 1) {
      return {
        style: {
          left: `${coloredTrackLeftPercent}%`,
          right: `${coloredTrackRightPercent}%`,
        },
      }
    }
    return {}
  }
)<Props>`
  ${({ index, trackColor, theme }): string => {
    if (index === 1) {
      return `
        background-color: ${trackColorToThemeColor(trackColor, theme)};
        z-index: 1;
      `
    }

    return `background-color: ${theme.colors.accentLight};`
  }}

  border-radius: 999px;
  bottom: 0;
  height: 0.5rem;
  top: 0.5rem;
`

export default SliderTrack

import styled, { Color } from 'styled-components'
import { coreDappTheme } from 'prepo-ui'
import { ThumbStyle } from './Slider'

const { sliderTrackBorderRadius } = coreDappTheme

type Props = {
  trackColor: keyof Color
  index: number
  coloredTrackLeftPercent: number
  coloredTrackRightPercent: number
  thumbStyles: [ThumbStyle, ThumbStyle]
}

// Set frequently changed props via .attrs to improve performance
const DualTrack = styled.div.attrs(
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
  bottom: 0;
  height: 0.8rem;
  top: 0.5rem;
  opacity: 0.22;
  background-color: ${({ trackColor, theme }): string => theme.color[trackColor]};

  ${({ index }): string => {
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
        opacity: 1;
      `
    }

    return ''
  }}
`

export default DualTrack

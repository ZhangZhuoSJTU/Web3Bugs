import styled, { Color } from 'styled-components'
import { coreDappTheme } from 'prepo-ui'

const { sliderTrackBorderRadius } = coreDappTheme

type Props = {
  trackColor: keyof Color
  index: number
}

const Wrapper = styled.div<Props>`
  border-radius: ${sliderTrackBorderRadius};
  bottom: 0;
  height: 0.8rem;
  top: 0.5rem;

  ${({ index, theme, trackColor }): string => {
    if (index === 0) {
      return `background-color: ${theme.color[trackColor]};`
    }

    return `
      background-color: ${theme.color[trackColor]};
      opacity: 0.22;
    `
  }}
`

const SingleSliderTrack: React.FC<Props> = ({ index, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Wrapper index={index} {...props} />
)

export default SingleSliderTrack

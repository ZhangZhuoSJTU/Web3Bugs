import React from 'react'
import styled from 'styled-components'
import { SupportedColor, trackColorToThemeColor } from './slider-utils'

type Props = {
  trackColor: SupportedColor
  index: number
}

const Wrapper = styled.div<Props>`
  border-radius: 999px;
  bottom: 0;
  height: 0.5rem;
  top: 0.5rem;

  ${({ index, theme, trackColor }): string => {
    if (index === 0) {
      return `background-color: ${trackColorToThemeColor(trackColor, theme)}`
    }

    return `background-color: ${theme.colors.accentLight};`
  }}
`

const SingleSliderTrack: React.FC<Props> = ({ index, ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Wrapper index={index} {...props} />
)

export default SingleSliderTrack

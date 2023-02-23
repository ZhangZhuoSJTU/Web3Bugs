import { media } from 'prepo-ui'
import { css } from 'styled-components'

// Brings the widget a bit more down on mobile to avoid blocking
// views like Trade page
export default css`
  #userback_button_container .userback-button-e[wstyle='text'],
  #userback_button_container .userback-button-e[wstyle='text_icon'] {
    transform: rotate(-90deg) translate(-150%, -50%) !important;

    ${media.tablet`
      transform: rotate(-90deg) translate(-50%, -50%) !important;
    `}
  }
`

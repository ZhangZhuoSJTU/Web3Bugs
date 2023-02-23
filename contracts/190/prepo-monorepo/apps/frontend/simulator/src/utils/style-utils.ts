import { css } from 'styled-components'

export const noSelect = css`
  -khtml-user-select: none; /* iOS Safari */
  -moz-user-select: none; /* Safari */
  -ms-user-select: none; /* Konqueror HTML */
  -webkit-touch-callout: none; /* Old versions of Firefox */
  -webkit-user-select: none; /* Internet Explorer/Edge */
  user-select: none; /* Non-prefixed version, currently
                                  supported by Chrome, Edge, Opera and Firefox */
`

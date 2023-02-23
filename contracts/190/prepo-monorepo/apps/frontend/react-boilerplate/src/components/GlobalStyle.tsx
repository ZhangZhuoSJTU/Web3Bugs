import { createGlobalStyle } from 'styled-components'
import { primaryFontFamily } from '../utils/theme/utils'

const GlobalStyle = createGlobalStyle`
  html {
    box-sizing: border-box;
    margin: 0; 
    height: 100%; 
  }
  *, *:before, *:after {
    box-sizing: inherit;
  }
  body {
    ${primaryFontFamily}
    height: 100%; 
    padding: 0;
    margin: 0;
    font-size: ${({ theme }): string => theme.fontSize.base};
    color: ${({ theme }): string => theme.color.primaryFont};
    background: ${({ theme }): string => theme.color.primaryBackground};
  }
  a {
    text-decoration: none;
    color: inherit;
    margin: 0;
    padding: 0;
    border: 0;
    font-size: 100%;
    font: inherit;
    vertical-align: baseline;
  }
`

export default GlobalStyle

import { createGlobalStyle } from 'styled-components'
import { coreDappTheme } from 'prepo-ui'
import { dropdownStyles } from './Search'
import { tooltipStyles } from './Tooltip'
import blocknativeStyles from '../utils/blocknative-modal-styles'
import userBackWidgetStyles from '../utils/userback-widget-styles'

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
    ${coreDappTheme.primaryFontFamily}
    height: 100%; 
    padding: 0;
    margin: 0;
    font-size: ${({ theme }): string => theme.fontSize.base};
    line-height: 2;
    color: ${({ theme }): string => theme.color.primary};
    background: ${({ theme }): string => theme.color.neutral10};
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
  h1,
  h2,
  h3,
  h4,
  h5 {
    color: ${({ theme }): string => theme.color.primary};
    line-height: 1;
    margin: 0;
  }
  
  /* Blocknative modal style classes */
  ${blocknativeStyles}

  /* Custom userback widget styles */
  ${userBackWidgetStyles}
`

export const AntdGlobalStyle = createGlobalStyle`
  ${dropdownStyles}
  ${tooltipStyles}
`

export default GlobalStyle

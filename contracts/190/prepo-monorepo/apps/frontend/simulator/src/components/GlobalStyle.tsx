import { createGlobalStyle } from 'styled-components'

// Add stubborn antd class styles to override here
const globalOverrides =
  'body, .ant-collapse, .ant-radio-wrapper, .ant-dropdown-menu-item, .ant-dropdown-menu-submenu-title'

const GlobalStyle = createGlobalStyle`
  ${globalOverrides} {
    font-size: ${({ theme }): string => theme.fontSize.base};
    font-family: ${({ theme }): string =>
      theme.fontFamily}; font-weight: normal; font-style: normal;
    color: ${({ theme }): string => theme.colors.textPrimary};
  }

  .ant-tooltip-inner, .ant-tooltip-arrow-content {
    background-color: ${({ theme }): string => theme.colors.tooltipBackground};
    color: ${({ theme }): string => theme.colors.foreground};
  }

  .ant-tooltip-inner {
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: bold;
  }

  .ant-tooltip-arrow-content {
    pointer-events: none;
  }

  .ant-input-affix-wrapper-focused {
    border-color: ${({ theme }): string => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }): string => theme.colors.primaryLight};
  }
  
  body {
    background: ${({ theme }): string => theme.colors.background};
  }
`

export default GlobalStyle

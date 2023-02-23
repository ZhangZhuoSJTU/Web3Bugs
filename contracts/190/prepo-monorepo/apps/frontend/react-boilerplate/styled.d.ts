import 'styled-components'

declare module 'styled-components' {
  export interface Color {
    primary: string
    primaryBackground: string
    secondaryBackground: string
    secondary: string
    primaryFont: string
    secondaryFont: string
    grayFont: string
    grayFontLight: string
    whiteFont: string
    primaryAccent: string
    secondaryAccent: string
    thirdAccent: string
    thirdBackground: string
    error: string
    lightGray: string
  }
  export interface DefaultTheme {
    fontSize: {
      /** 9px */
      '2xs': string
      /** 12px */
      xs: string
      /** 14px */
      sm: string
      /** 16px */
      base: string
      /** 18px */
      md: string
      /** 20px */
      lg: string
      /** 24px */
      xl: string
      /** 28px */
      '2xl': string
      /** 30px */
      '3xl': string
      /** 36px */
      '4xl': string
      /** 40px */
      '5xl': string
    }
    fontFamily: {
      /** Open Sans */
      primary: string
      /** Inter */
      secondary: string
    }
    fontWeight: {
      /** 800 */
      extraBold: number
      /** 700 */
      bold: number
      /** 600 */
      semiBold: number
      /** 500 */
      medium: number
      /** 400 */
      regular: number
    }
    color: Color
    borderRadius: number
  }
}

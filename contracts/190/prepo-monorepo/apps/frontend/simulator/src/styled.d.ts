// import original module declarations
import 'styled-components'
import { Theme } from './features/app/themes'

// and extend them!
declare module 'styled-components' {
  export interface DefaultTheme {
    name: Theme
    colors: {
      primary: string
      primaryLight: string
      subtitle: string
      background: string
      foreground: string
      accent: string
      accentLight: string
      buttonLight: string
      profit: string
      profitBright: string
      loss: string
      textPrimary: string
      textSecondary: string
      tooltipBackground: string
    }
    fontFamily: string
    fontSize: {
      sm: string
      xsm: string
      base: string
      lg: string
      lgx: string
      xl: string
      xxl: string
      xxxl: string
      xxxxl: string
      xxxxxl: string
    }
  }
}

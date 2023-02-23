import { ThemeModes, coreDappTheme } from './index'
import 'styled-components'

declare module 'styled-components' {
  export interface BorderRadius {
    /** 24px */
    lg: string
    /** 20px */
    base: string
    /** 16px */
    md: string
    /** 14px */
    sm: string
    /** 12px */
    xs: string
  }

  export interface Shadow {
    /** 0px 4px 22px rgba(98, 100, 217, 0.11) */
    prepo: string
  }
  export interface Color {
    /** #3335CC */
    darkPrimary: string
    /** #6264D8 */
    primary: string
    /** #FCFAFF | #40444F */
    primaryAccent: string
    /** #6264D8 | #9B9DFF */
    primaryLight: string
    /** #6264D8 | #FFFFFF */
    primaryWhite: string
    /** #454699 | #9B9DFF */
    darkPrimaryLight: string
    /** #FCFAFF | #1B1E22 */
    accent1: string
    /** #FCFAFF | #191B1F */
    accent2: string
    /** #525252 | #FCFAFF */
    accent3: string
    /** #14154F | #FFFFFF */
    secondary: string
    /** #525252 | #FFFFFF */
    neutral1: string
    /** #525252 | #A6B0C3 */
    neutral2: string
    /** #6A7271 | #A6B0C3 */
    neutral3: string
    /** #6A7271 | #FFFFFF */
    neutral4: string
    /** #A6B0C3 */
    neutral5: string
    /** #EFF2F5 | #A6B0C3 */
    neutral6: string
    /** #EFF2F5 | #40444F */
    neutral7: string
    /** #EFF2F5 | #212429 */
    neutral8: string
    /** #FFFFFF | #212429 */
    neutral9: string
    /** #FFFFFF | #191B1F */
    neutral10: string
    /** #929AA2 | #A6B0C3 */
    neutral11: string
    /** #F7F8FA | #1B1E22 */
    neutral12: string
    /** #EDEEF2 | #212429 */
    neutral13: string
    /** #47AFF8 */
    info: string
    /** #EB5757 */
    error: string
    /** #27AE60 */
    success: string
    /** #EEA900 */
    warning: string
    /** #FAFDFF | #212429 */
    accentInfo: string
    /** #FEF7F7 | #212429 */
    accentError: string
    /** #FCFAFF | #212429 */
    accentPrimary: string
    /** #F4FBF7 | #212429 */
    accentSuccess: string
    /** #FEFCF5 | #212429 */
    accentWarning: string
    /** #FAF5FE | #212429 */
    accentPurple: string
    /** #E5E5FB | #40444F */
    purpleStroke: string
    /** #FAFDFF | #40444F */
    alertBoxInfo: string
    /** #F4FBF7 | #40444F */
    alertBoxSuccess: string
    /** #FEF7F7 | #40444F */
    alertBoxError: string
    /** #FFF1D7 | #40444F */
    alertBoxWarning: string
    /** #EFF2F5 | #1B1E22 */
    exploreCardBorder: string
    /** #14154F | #EEA900 */
    liquidityBrush: string
    /** #FFFFFF | #1C1E22 */
    marketChartBackground: string
    /** #FFFFFF | #40444F */
    marketChartFloatingCard: string
    /** #FCFAFF | #191B1F */
    searchInputBackground: string
    /** #6264D8 | #212429 */
    searchInputBorder: string
    /** #14154F | #6264D8 */
    sliderTooltipBackground: string
    /** #EFF2F5 */
    switchHandler: string
    /** #14154F | #40444F */
    tabActiveBackground: string
    /** #8500EE | #8500EE */
    bondingEvent: string
    /** #14154F */
    darkBlue: string
    /** #FFFFFF */
    white: string
    /** orange */
    orange: string
    elitePregenBackground: string
    executiveBackground: string
    executiveIconFill: string
    executiveInfo: string
    preacherBackground: string
    preacherIconBackground: string
    preacherIconFill: string
    preacherTextColor: string
    profileBorderColor: string
    transparent: 'transparent'
  }

  export interface Weight {
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

  export interface PositionTypeStates {
    long: string
    short: string
    liquidity: string
  }

  export interface DefaultTheme {
    breakpoints: coreDappTheme.BreakpointType
    color: Color
    positionType: PositionTypeStates
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
      primary: string
      secondary: string
    }
    fontWeight: Weight
    borderRadius: BorderRadius
    boxRadiusPx: string
    mode: ThemeModes
    shadow: Shadow
    isDarkMode: boolean
  }
}

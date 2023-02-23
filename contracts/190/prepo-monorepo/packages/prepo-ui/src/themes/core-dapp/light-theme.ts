import { DefaultTheme } from 'styled-components'
import { colors } from './colors'
import { borderRadius, boxRadiusPx, shadow } from './common'
import { fontSize, fontWeight, fontFamily } from './font-utils'
import { breakpoints } from './breakpoints'
import { TRANSPARENT } from './utils'
import { ThemeModes } from '../themes.types'

// primary colors and its variants
const darkPrimary = colors.purple6
const primary = colors.purple3
const primaryAccent = colors.purple1
const primaryLight = colors.purple3
const primaryWhite = colors.purple3
const darkPrimaryLight = colors.purple6

// accent colors
const accent1 = colors.purple1
const accent2 = colors.purple1
const accent3 = colors.gray4

// secondary color
const secondary = colors.blue2

// neutral colors (mostly gray colors in different combination)
const neutral1 = colors.gray4
const neutral2 = colors.gray4
const neutral3 = colors.gray3
const neutral4 = colors.gray3
const neutral5 = colors.gray2
const neutral6 = colors.gray1
const neutral7 = colors.gray1
const neutral8 = colors.gray1
const neutral9 = colors.white
const neutral10 = colors.white
const neutral11 = colors.gray12
const neutral12 = colors.gray13
const neutral13 = colors.gray14

const purpleStroke = colors.purple13

// semantic
const info = colors.blue3
const error = colors.red2
const success = colors.green2
const warning = colors.orange3

// semantic accent
const accentInfo = colors.blue1
const accentError = colors.red1
const accentPrimary = colors.purple1
const accentSuccess = colors.green1
const accentWarning = colors.orange1
const accentPurple = colors.purple9

// semantic alert boxes
const alertBoxSuccess = colors.green1
const alertBoxInfo = colors.blue1
const alertBoxError = colors.red1
const alertBoxWarning = colors.orange2

// componets specific
const exploreCardBorder = colors.gray1
const liquidityBrush = colors.blue2
const marketChartBackground = colors.white
const marketChartFloatingCard = colors.white
const searchInputBackground = colors.purple1
const searchInputBorder = colors.purple3
const sliderTooltipBackground = colors.blue2
const switchHandler = colors.gray1
const tabActiveBackground = colors.blue2
const bondingEvent = colors.purple10

// profile banners
const elitePregenBackground = colors.blue6
const executiveBackground = colors.blue7
const executiveIconFill = colors.yellow1
const executiveInfo = colors.gray10
const preacherBackground = `linear-gradient(90deg, ${colors.purple5}, ${colors.purple6})`
const preacherIconBackground = `linear-gradient(${colors.blue4}, ${colors.blue5})`
const preacherIconFill = `linear-gradient(${colors.purple7}, ${colors.purple8})`
const preacherTextColor = colors.gray11
const profileBorderColor = colors.purple12

// Mode
const mode = ThemeModes.Light

const positionType = {
  long: success,
  short: error,
  liquidity: primary,
}

const lightTheme: DefaultTheme = {
  breakpoints,
  color: {
    darkPrimary,
    primary,
    primaryAccent,
    primaryLight,
    primaryWhite,
    darkPrimaryLight,
    accent1,
    accent2,
    accent3,
    secondary,
    neutral1,
    neutral2,
    neutral3,
    neutral4,
    neutral5,
    neutral6,
    neutral7,
    neutral8,
    neutral9,
    neutral10,
    neutral11,
    neutral12,
    neutral13,
    info,
    error,
    success,
    warning,
    accentInfo,
    accentError,
    accentPrimary,
    accentSuccess,
    accentWarning,
    accentPurple,
    purpleStroke,
    alertBoxInfo,
    alertBoxSuccess,
    alertBoxError,
    alertBoxWarning,
    exploreCardBorder,
    liquidityBrush,
    marketChartBackground,
    marketChartFloatingCard,
    searchInputBackground,
    searchInputBorder,
    sliderTooltipBackground,
    switchHandler,
    tabActiveBackground,
    bondingEvent,
    darkBlue: colors.blue2,
    white: colors.white,
    orange: colors.orange4,
    elitePregenBackground,
    executiveBackground,
    executiveIconFill,
    executiveInfo,
    preacherBackground,
    preacherIconBackground,
    preacherIconFill,
    preacherTextColor,
    profileBorderColor,
    transparent: TRANSPARENT,
  },
  positionType,
  fontSize,
  fontFamily,
  fontWeight,
  borderRadius,
  boxRadiusPx,
  mode,
  shadow,
  isDarkMode: false,
}

export default lightTheme

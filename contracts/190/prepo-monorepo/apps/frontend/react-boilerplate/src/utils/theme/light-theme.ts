import { DefaultTheme } from 'styled-components'
import { fontSize, fontFamily, fontWeight } from './font-utils'
import { borderRadius } from './general-settings'

// Fonts
const primaryFont = '#1D293F'
const secondaryFont = '#8C97AC'
const grayFont = '#5D5D5D'
const grayFontLight = '#7c8087'
const whiteFont = '#FFFFFF'

// Colors
const primary = '#5700B3'
const secondary = '#1B2436'
const error = '#ed139d'
const primaryAccent = '#000000'
const secondaryAccent = '#0DC675'
const thirdAccent = '#07653B'
const lightGray = '#F2EBF9'
const primaryBackground = '#FFFFFF'
const secondaryBackground = '#FFFFFF'
const thirdBackground = '#0C001A'

export const lightTheme: DefaultTheme = {
  fontSize,
  fontFamily,
  fontWeight,
  color: {
    primary,
    primaryBackground,
    secondaryBackground,
    secondary,
    primaryFont,
    secondaryFont,
    grayFont,
    grayFontLight,
    whiteFont,
    primaryAccent,
    secondaryAccent,
    thirdAccent,
    thirdBackground,
    error,
    lightGray,
  },
  borderRadius,
}

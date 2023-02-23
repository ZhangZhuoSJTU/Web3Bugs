import darkTheme from './dark-theme'
import lightTheme from './light-theme'
import { ThemeModes } from '../themes.types'

export * from './common'
export * from './utils'
export * from './font-utils'
export * from './breakpoints'

const coreDappTheme = {
  [ThemeModes.Dark]: darkTheme,
  [ThemeModes.Light]: lightTheme,
}

export default coreDappTheme

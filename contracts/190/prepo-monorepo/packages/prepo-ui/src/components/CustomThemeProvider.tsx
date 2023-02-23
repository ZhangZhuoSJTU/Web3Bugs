import { ThemeProvider, DefaultTheme } from 'styled-components'
import { ThemeModes } from '../themes/themes.types'
import coreDapp from '../themes/core-dapp'

export enum PresetTheme {
  CoreDapp = 'core-dapp',
}

type Props = {
  theme: PresetTheme | DefaultTheme
  mode?: ThemeModes
}

type GetTheme = (theme: PresetTheme | DefaultTheme, mode: ThemeModes) => DefaultTheme

const getTheme: GetTheme = (theme, mode) => {
  switch (theme) {
    case PresetTheme.CoreDapp:
      return coreDapp[mode]
    default:
      return theme
  }
}

const CustomThemeProvider: React.FC<Props> = ({ theme, mode = ThemeModes.Light, children }) => {
  const themeToUse = getTheme(theme, mode)
  return (
    <ThemeProvider theme={themeToUse}>
      <>{children}</>
    </ThemeProvider>
  )
}

export default CustomThemeProvider

import React from 'react'

import CustomThemeProvider, { PresetTheme } from '../src/components/CustomThemeProvider'
import { ThemeModes } from '../src/themes/themes.types'

import 'antd/dist/antd.css'

export const decorators = [
  (Story) => (
    <CustomThemeProvider theme={PresetTheme.CoreDapp} mode={ThemeModes.Light}>
      <Story />
    </CustomThemeProvider>
  ),
]

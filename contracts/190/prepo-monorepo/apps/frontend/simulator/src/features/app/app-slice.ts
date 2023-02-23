import { DefaultTheme } from 'styled-components'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import themes, { Theme } from './themes'

interface GlobalState {
  theme: DefaultTheme
  step: number
  startOver: boolean
}

const initialState: GlobalState = {
  theme: themes.standard,
  step: 0,
  startOver: false,
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    themeChanged(state, action: PayloadAction<Theme>) {
      state.theme = themes[action.payload]
    },
    stepChanged(state, action: PayloadAction<number>) {
      state.step = action.payload
    },
    startOver(state, action: PayloadAction<boolean>) {
      state.startOver = action.payload
    },
    reset() {
      return initialState
    },
  },
})

export const { actions } = appSlice
export default appSlice.reducer

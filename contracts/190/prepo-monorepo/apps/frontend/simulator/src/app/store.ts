import { configureStore } from '@reduxjs/toolkit'
import positionReducer from '../features/position/position-slice'
import appReducer from '../features/app/app-slice'

export const store = configureStore({
  reducer: {
    position: positionReducer,
    app: appReducer,
  },
})

export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>

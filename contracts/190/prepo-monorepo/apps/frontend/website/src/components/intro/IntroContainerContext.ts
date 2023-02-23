import { createContext } from 'react'

type Props = {
  visibilityRatio: number
}

export const IntroContainerContext = createContext<Props>({ visibilityRatio: 0 })

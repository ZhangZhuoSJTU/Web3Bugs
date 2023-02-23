import { useEffect, useState } from 'react'

export const useIsLargeScreen = (): boolean => {
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  useEffect(() => {
    setIsLargeScreen(document.documentElement.clientWidth >= 1024)
  }, [])
  return isLargeScreen
}

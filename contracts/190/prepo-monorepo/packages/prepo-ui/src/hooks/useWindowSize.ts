import { useEffect, useState } from 'react'

type WindowSizeProps = {
  height?: number
  width?: number
}

export const useWindowSize = (): WindowSizeProps => {
  // Initialize state with undefined width/height so server and client renders match
  const [windowSize, setWindowSize] = useState<WindowSizeProps>({
    width: undefined,
    height: undefined,
  })

  useEffect(() => {
    const handleResize = (): void => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    // only execute all the code below in client side
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)

      // Call handler right away so state gets updated with initial window size
      handleResize()
    }
    return (): void => window.removeEventListener('resize', handleResize)
  }, [])
  return windowSize
}

export default useWindowSize

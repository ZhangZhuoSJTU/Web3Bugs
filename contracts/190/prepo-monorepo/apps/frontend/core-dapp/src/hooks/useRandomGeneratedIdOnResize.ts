import { useEffect, useRef, useState } from 'react'

export const useRandomGeneratedIdOnResize = (): string => {
  const [id, setId] = useState('container_id')
  const previousWidth = useRef(0)
  useEffect(() => {
    const onResize = (): void => {
      if (previousWidth.current !== window.innerWidth) {
        previousWidth.current = window.innerWidth
        setId(Math.floor(Math.random() * 100).toString())
      }
    }
    window.addEventListener('resize', onResize)
    return (): void => {
      window.removeEventListener('resize', onResize)
    }
  }, [])
  return id
}

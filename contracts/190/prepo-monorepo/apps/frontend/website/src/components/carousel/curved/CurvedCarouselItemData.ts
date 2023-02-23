import { ReactNode } from 'react'
import { IconName } from '../../Icon'

export type CurvedCarouselItemData = {
  id: string | number
  title: string
  icon: IconName
  content: string | ReactNode
  href?: string
}

import { ReactNode } from 'react'
import { IconName } from '../../Icon'

export type FlatCarouselItemData = {
  id: string | number
  caption: string
  title: string
  icon: IconName
  content: string | ReactNode
  current?: boolean
}

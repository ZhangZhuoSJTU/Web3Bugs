import { FC } from 'react'
import clsx from 'clsx'
import { FlatCarouselItemData } from './FlatCarouselItemData'
import { Icon } from '../../Icon'

type FlatCarouselItemProps = Omit<FlatCarouselItemData, 'id'> & {
  grayed?: boolean
}

export const FlatCarouselItem: FC<FlatCarouselItemProps> = ({
  icon,
  caption,
  title,
  content,
  grayed,
}) => (
  <article className={clsx('w-[250px] text-center', grayed ? 'grayscale' : '')}>
    <div className="inline-grid place-items-center w-12 h-12 bg-white rounded-full shadow-prepo-3 sm:w-16 sm:h-16 sm:shadow-prepo-4">
      <div className="grid place-items-center w-9 h-9 text-prepo bg-prepo-light rounded-full sm:w-12 sm:h-12">
        <Icon name={icon} className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
    </div>
    <div className={grayed ? 'opacity-60' : ''}>
      <div className="my-4 text-sm font-bold leading-[18px] text-title">{caption}</div>
      <div className="box-border py-5 rounded-lg border-[1.5px] border-prepo/[8%]">
        <h2 className="font-bold leading-[18px] text-title text-md">{title}</h2>
        <p className="mt-2 text-sm font-medium leading-[151.3%]">{content}</p>
      </div>
    </div>
  </article>
)

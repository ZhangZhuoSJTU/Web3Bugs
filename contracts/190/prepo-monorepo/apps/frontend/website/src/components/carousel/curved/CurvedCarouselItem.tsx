import clsx from 'clsx'
import { FC } from 'react'
import { CurvedCarouselItemData } from './CurvedCarouselItemData'

type CurvedCarouselItemProps = Pick<CurvedCarouselItemData, 'title' | 'content' | 'href'> & {
  className?: string
}

export const CurvedCarouselItem: FC<CurvedCarouselItemProps> = ({
  title,
  content,
  href,
  className,
}) => (
  <article className={clsx('max-w-[300px] text-center sm:max-w-[360px]', className)}>
    <h2 className="text-lg font-bold leading-[130.3%] text-title sm:text-2xl">{title}</h2>
    <p className="mt-3 mb-5 text-sm font-medium leading-[166.5%] sm:text-base sm:leading-[154%]">
      {content}
    </p>
    {href && (
      <a
        href={href}
        className="text-sm font-semibold leading-[155.8%] text-prepo hover:text-prepo-accent underline decoration-2 underline-offset-4 sm:text-base"
        target="_blank"
        rel="noreferrer"
      >
        Learn More
      </a>
    )}
  </article>
)

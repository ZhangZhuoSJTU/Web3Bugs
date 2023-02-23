import clsx from 'clsx'
import { DetailedHTMLProps, HTMLAttributes } from 'react'
import { Intro } from './intro'

type SectionTitleProps = DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>

const SectionTitle: React.FC<SectionTitleProps> = ({ className, children, ...props }) => (
  <Intro type="fadeIn">
    <h1
      className={clsx(
        'mb-4 text-[24px] font-bold leading-[152.3%] text-title sm:text-[32px] lg:text-[48px] lg:leading-[137.8%]',
        className
      )}
      {...props}
    >
      {children}
    </h1>
  </Intro>
)

export default SectionTitle

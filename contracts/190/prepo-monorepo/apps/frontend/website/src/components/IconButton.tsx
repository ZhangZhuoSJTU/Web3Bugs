import clsx from 'clsx'
import { FC } from 'react'
import { Icon, IconName } from './Icon'

export type IconButtonProps = Omit<
  React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>,
  'aria-label'
> & {
  icon: IconName
  iconClass?: string
  'aria-label': string // empty value would cause accessibility/SEO score drop on lighthouse as there is no text on icon button
}

export const IconButton: FC<IconButtonProps> = ({ icon, iconClass, className, ...props }) => (
  <button
    type="button"
    className={clsx(
      'flex flex-col justify-center text-prepo hover:text-prepo-accent disabled:hover:text-prepo bg-prepo-light disabled:opacity-50 transition-colors disabled:cursor-default',
      className
    )}
    {...props}
  >
    <Icon name={icon} className={clsx('self-center w-1/2 h-1/2', iconClass)} />
  </button>
)

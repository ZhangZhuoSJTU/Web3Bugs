import { FC, SVGProps } from 'react'
import icons from './icons'

export type IconName = keyof typeof icons

export type IconProps = SVGProps<SVGSVGElement> & { name: IconName }

export const Icon: FC<IconProps> = ({ name, ...props }) => {
  const Component = icons[name]
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Component {...props} />
}

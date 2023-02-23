import { coreDappTheme, IconName } from 'prepo-ui'
import { Color } from 'styled-components'
import IconTitle from './IconTitle'
import useResponsive from '../hooks/useResponsive'

const { fontSize } = coreDappTheme

type Props = {
  id?: string
  iconName: IconName
  className?: string
  size: 'lg' | 'md' | 'sm'
  color?: keyof Color
}

type Sizes = {
  icon: {
    lg: number
    md: number
    sm: number
  }
  text: {
    lg: keyof typeof fontSize
    md: keyof typeof fontSize
    sm: keyof typeof fontSize
  }
}

const DESKTOP_SIZES: Sizes = {
  icon: {
    lg: 50,
    md: 44,
    sm: 32,
  },
  text: {
    lg: '4xl',
    md: 'xl',
    sm: 'base',
  },
}

const MOBILE_SIZES: Sizes = {
  icon: {
    lg: 30,
    md: 30,
    sm: 24,
  },
  text: {
    lg: 'base',
    md: 'base',
    sm: 'base',
  },
}

const MarketIconTitle: React.FC<Props> = ({ id, size, iconName, className, color, children }) => {
  const { isDesktop } = useResponsive()
  const sizes: Sizes = isDesktop ? DESKTOP_SIZES : MOBILE_SIZES

  return (
    <IconTitle
      id={id}
      className={className}
      iconName={iconName}
      iconSize={sizes.icon[size]}
      labelFontSize={sizes.text[size]}
      color={color}
    >
      {children}
    </IconTitle>
  )
}

export default MarketIconTitle

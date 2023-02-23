import { coreDappTheme, IconName } from 'prepo-ui'
import IconTitle from '../IconTitle'
import useResponsive from '../../hooks/useResponsive'

const { fontSize } = coreDappTheme

type Props = {
  iconName: IconName
  description?: string
  className?: string
}

type Sizes = {
  icon: number
  text: keyof typeof fontSize
}

const DESKTOP_SIZES: Sizes = {
  icon: 32,
  text: 'lg',
}

const MOBILE_SIZES: Sizes = {
  icon: 32,
  text: 'sm',
}

const CurrencyTitleIcon: React.FC<Props> = ({ iconName, className, children, description }) => {
  const { isDesktop } = useResponsive()
  const sizes: Sizes = isDesktop ? DESKTOP_SIZES : MOBILE_SIZES

  return (
    <IconTitle
      className={className}
      iconName={iconName}
      iconSize={sizes.icon}
      labelFontSize={sizes.text}
      weight="medium"
      color="neutral1"
      description={description}
    >
      {children}
    </IconTitle>
  )
}

export default CurrencyTitleIcon

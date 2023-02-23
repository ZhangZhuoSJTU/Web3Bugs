import { coreDappTheme, IconName } from 'prepo-ui'
import IconTitle from '../../components/IconTitle'
import useResponsive from '../../hooks/useResponsive'

type Props = {
  className?: string
  iconName: IconName
}

const { fontSize } = coreDappTheme

const CurrencyIconTitle: React.FC<Props> = ({ className, iconName, children }) => {
  const { isDesktop } = useResponsive()
  let iconSize = 24
  let lableFontSize: keyof typeof fontSize = 'md'
  if (isDesktop) {
    iconSize = 30
    lableFontSize = 'lg'
  }

  return (
    <IconTitle
      className={className}
      iconName={iconName}
      iconSize={iconSize}
      labelFontSize={lableFontSize}
      color="neutral1"
    >
      {children}
    </IconTitle>
  )
}

export default CurrencyIconTitle

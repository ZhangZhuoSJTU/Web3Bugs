import { DetailedHTMLProps, HTMLAttributes } from 'react'
import { Color, useTheme } from 'styled-components'
import { IconProps } from './icon.types'
import { applicationIcons } from './icon-components/application'
import { currencyIcons } from './icon-components/currencies'
import { emojisIcons } from './icon-components/emojis'
import { marketsIcons } from './icon-components/markets'
import { socialMediaIcons } from './icon-components/social-media'
import { networksIcons } from './icon-components/networks'
import { cexIcons } from './icon-components/cex'
import { brandIcons } from './icon-components/brands'

export const iconsList = {
  ...applicationIcons,
  ...brandIcons,
  ...cexIcons,
  ...currencyIcons,
  ...emojisIcons,
  ...marketsIcons,
  ...networksIcons,
  ...socialMediaIcons,
}

export type Props = IconProps &
  DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & { color?: keyof Color }

const Icon: React.FC<Props> = ({
  id,
  name,
  onClick,
  color = 'primary',
  disabled = false,
  height,
  width,
  ...otherProps
}) => {
  const theme = useTheme()
  const IconComponent = iconsList[name]
  const iconColor = theme.color[color]

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <span style={{ display: 'flex' }} {...otherProps}>
      <IconComponent
        id={id}
        onClick={onClick}
        color={iconColor}
        height={height}
        width={width}
        disabled={disabled}
      />
    </span>
  )
}

export default Icon

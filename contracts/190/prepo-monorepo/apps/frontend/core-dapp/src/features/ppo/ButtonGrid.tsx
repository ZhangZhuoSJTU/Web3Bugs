import { ButtonColors, media, spacingIncrement } from 'prepo-ui'
import styled, { Color, css, DefaultTheme } from 'styled-components'
import ButtonLink, { ButtonLinkProps } from './ButtonLink'
import { lightPurpleButtonStyles } from './ppo-button-styles'
import useResponsive from '../../hooks/useResponsive'
import { IconSizeResponsive } from '../../types/general.types'

export type ButtonGridItem = Pick<ButtonLinkProps, 'title' | 'href' | 'target' | 'iconName'>

export type ButtonGridStyles = ButtonColors & {
  borderColor?: keyof Color
  fontColor?: keyof Color
  iconStyles?: {
    desktop?: {
      top: string
      left: string
    }
    mobile?: {
      top: string
      left: string
    }
  }
  fontSize?: {
    desktop: keyof DefaultTheme['fontSize']
    mobile: keyof DefaultTheme['fontSize']
  }
  fontWeight?: {
    desktop: keyof DefaultTheme['fontWeight']
    mobile: keyof DefaultTheme['fontWeight']
  }
}

type Props = {
  className?: string
  items: ButtonGridItem[]
  customStyles?: ButtonGridStyles
  iconSize?: IconSizeResponsive
  externalIconSize?: IconSizeResponsive
  alignExternalIcon?: 'default' | 'right'
}

const MAX_BUTTON_WIDTH = 378
const GAP = 24
const MAX_WIDTH = MAX_BUTTON_WIDTH * 2 + GAP
const DEFAULT_EXTERNAL_ICON_SIZE = {
  desktop: 15,
  mobile: 15,
}
const DEFAULT_ICON_SIZE = {
  desktop: 20,
  mobile: 20,
}
const DEFAULT_CUSTOM_STYLES = lightPurpleButtonStyles

type ButtonStylesProps = { customStyles?: ButtonGridStyles }

const buttonStyles = css<ButtonStylesProps>`
  border: ${({ customStyles, theme }): string =>
    customStyles?.borderColor ? `1px solid ${theme.color[customStyles.borderColor]}` : 'none'};
  color: ${({ customStyles, theme }): string => theme.color[customStyles?.fontColor || 'primary']};
  font-size: ${({ customStyles, theme }): string =>
    theme.fontSize[customStyles?.fontSize?.mobile || 'sm']};
  font-weight: ${({ customStyles, theme }): number =>
    theme.fontWeight[customStyles?.fontWeight?.mobile || 'semiBold']};
  height: ${spacingIncrement(62)};
  justify-self: center;
  max-width: ${spacingIncrement(MAX_BUTTON_WIDTH)};
  position: relative;
  width: 100%;

  ${media.desktop<ButtonStylesProps>`
    height: ${spacingIncrement(78)};
    font-size: ${({ customStyles, theme }): string =>
      theme.fontSize[customStyles?.fontSize?.desktop || 'md']};
    font-weight: ${({ customStyles, theme }): number =>
      theme.fontWeight[customStyles?.fontWeight?.desktop || 'semiBold']};
  `}
`

const Grid = styled.div<ButtonStylesProps>`
  display: grid;
  grid-gap: ${spacingIncrement(16)};
  grid-template-columns: 1fr;
  margin: 0 auto;
  max-width: ${spacingIncrement(MAX_WIDTH)};
  ${media.desktop`
    grid-template-columns: 1fr 1fr;
    grid-gap: ${spacingIncrement(GAP)};
  `}

  &&& {
    .ant-btn {
      ${buttonStyles};
    }
    .ant-btn:hover {
      color: ${({ customStyles, theme }): string =>
        theme.color[customStyles?.fontColor || 'primary']};
    }
  }
  > a {
    ${buttonStyles};
  }

  > div {
    display: flex;
    justify-content: center;
  }
`

export const ButtonGrid: React.FC<Props> = ({
  className,
  items,
  customStyles = DEFAULT_CUSTOM_STYLES,
  iconSize = DEFAULT_ICON_SIZE,
  externalIconSize = DEFAULT_EXTERNAL_ICON_SIZE,
  alignExternalIcon = 'default',
}) => {
  const { isDesktop } = useResponsive()
  const iconSizeValue = isDesktop ? iconSize.desktop : iconSize.mobile
  const externalIconSizeValue = isDesktop ? externalIconSize.desktop : externalIconSize.mobile
  return (
    <Grid className={className} customStyles={customStyles}>
      {items.map(({ title, iconName, href, target }) => (
        <ButtonLink
          key={title}
          title={title}
          iconName={iconName}
          href={href}
          target={target}
          iconSize={iconSizeValue}
          customStyles={customStyles}
          externalIconStyles={{
            size: externalIconSizeValue,
            align: alignExternalIcon,
          }}
        />
      ))}
    </Grid>
  )
}

import Link from 'next/link'
import { Icon, IconName, spacingIncrement } from 'prepo-ui'
import styled, { Color } from 'styled-components'

type MenuItemProps = {
  color?: keyof Color
  hoverColor?: keyof Color
  iconName: IconName
  href?: string
  external?: boolean
  onClick?: () => void
}

type MenuItemButtonProps = { external?: boolean; color: keyof Color; hoverColor: keyof Color }

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  padding: 0 ${spacingIncrement(18)};
`

const MenuItemButton = styled.button<MenuItemButtonProps>`
  align-items: center;
  background-color: ${({ theme }): string => theme.color.neutral10};
  border: none;
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  color: ${({ color, theme }): string => theme.color[color]};
  cursor: pointer;
  display: flex;
  font-size: ${({ theme, external }): string => theme.fontSize[external ? 'xs' : 'sm']};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  justify-content: space-between;
  padding: ${spacingIncrement(6)};
  width: 100%;
  :hover {
    background-color: ${({ theme }): string => theme.color.accentPrimary};
    color: ${({ hoverColor, theme }): string => theme.color[hoverColor]};
  }
  p {
    margin-bottom: 0;
  }
`

const SettingsMenuItem: React.FC<MenuItemProps> = ({
  children,
  color = 'neutral1',
  hoverColor = 'primary',
  external,
  iconName,
  href,
  onClick,
}) => {
  const iconSize = external ? '14px' : '18px'
  const linkProps = external ? { target: '_blank', rel: 'noreferrer' } : {}

  const menuButton = (
    <MenuItemButton color={color} hoverColor={hoverColor} external={external} onClick={onClick}>
      <p>{children}</p>
      <Icon name={iconName} height={iconSize} width={iconSize} />
    </MenuItemButton>
  )

  if (href)
    return (
      <Wrapper onClick={onClick}>
        <Link href={href} passHref>
          <a href={href} {...linkProps} style={{ width: '100%' }}>
            {menuButton}
          </a>
        </Link>
      </Wrapper>
    )

  return <Wrapper>{menuButton}</Wrapper>
}

export default SettingsMenuItem

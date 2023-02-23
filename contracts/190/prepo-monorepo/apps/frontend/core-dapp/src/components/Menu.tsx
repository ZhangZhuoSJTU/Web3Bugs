/* eslint-disable react/jsx-props-no-spreading */
import { Menu as AMenu, MenuProps, MenuItemProps } from 'antd'
import styled, { css, DefaultTheme, FlattenInterpolation, ThemeProps } from 'styled-components'
import { spacingIncrement } from 'prepo-ui'
import { forwardRef } from 'react'

export const MenuItem: React.FC<MenuItemProps> = (props) => (
  <>
    <AMenu.Item {...props} />
    <AMenu.Divider />
  </>
)

type Props = {
  size?: 'sm' | 'md' | 'lg'
  keepBackgroundColorOnHover?: boolean
}

const keepBackgroundOnHover = css`
  .ant-dropdown-menu-item-active {
    background-color: ${({ theme }): string => theme.color.neutral10};
    * {
      color: ${({ theme }): string => theme.color.neutral3};
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
    }
    :hover {
      * {
        color: ${({ theme }): string => theme.color.primary};
        font-weight: ${({ theme }): number => theme.fontWeight.medium};
      }
    }
  }
`

const hoverBackground = css`
  .ant-dropdown-menu-item-active {
    background-color: ${({ theme }): string => theme.color.neutral7};
  }
`

const sizeSmallStyles = css`
  .ant-dropdown-menu-item {
    height: ${spacingIncrement(39)};
  }
  .ant-dropdown-menu-title-content {
    font-size: ${({ theme }): string => theme.fontSize.xs};
  }
`

const sizeMediumStyles = css`
  .ant-dropdown-menu-item {
    height: ${spacingIncrement(60)};
  }
  .ant-dropdown-menu-title-content {
    font-size: ${({ theme }): string => theme.fontSize.base};
  }
`

const sizeLargeStyles = css`
  .ant-dropdown-menu-item {
    height: ${spacingIncrement(74)};
  }
  .ant-dropdown-menu-title-content {
    font-size: ${({ theme }): string => theme.fontSize.xl};
  }
`

const Wrapper = styled.div<Props>`
  &&& {
    ${({ size }): FlattenInterpolation<ThemeProps<DefaultTheme>> => {
      if (size === 'md') {
        return sizeMediumStyles
      }
      if (size === 'lg') {
        return sizeLargeStyles
      }
      return sizeSmallStyles
    }}
    .ant-dropdown-menu {
      background-color: ${({ theme }): string => theme.color.neutral9};
      border-radius: ${({ theme }): string => theme.borderRadius.xs};
      padding: 0;
    }
    ${({ keepBackgroundColorOnHover }): FlattenInterpolation<ThemeProps<DefaultTheme>> =>
      keepBackgroundColorOnHover ? keepBackgroundOnHover : hoverBackground}
    .ant-dropdown-menu-item-divider {
      background-color: transparent;
      height: 2px;
      margin: 0;
      :last-child {
        display: none;
      }
    }
    .ant-dropdown-menu-title-content {
      color: ${({ theme }): string => theme.color.neutral2};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
    }
    .ant-dropdown-menu-item-selected,
    .ant-dropdown-menu-submenu-title-selected {
      background-color: inherit;
      .ant-dropdown-menu-title-content {
        color: ${({ theme }): string => theme.color.primaryWhite};
      }
    }
  }
`

const Menu: React.FC<MenuProps & Props> = forwardRef(
  ({ size, keepBackgroundColorOnHover, className, ...props }, ref: React.Ref<HTMLDivElement>) => (
    <Wrapper
      ref={ref}
      size={size}
      keepBackgroundColorOnHover={keepBackgroundColorOnHover}
      className={className}
    >
      <AMenu {...props} />
    </Wrapper>
  )
)
Menu.displayName = 'Menu'

export default Menu

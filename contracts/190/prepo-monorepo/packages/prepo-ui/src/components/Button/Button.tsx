import { Button as AButton, ButtonProps as AButtonProps } from 'antd'
import Link from 'next/link'
import styled, {
  Color,
  css,
  DefaultTheme,
  FlattenInterpolation,
  ThemeProps,
} from 'styled-components'
import { useMemo } from 'react'
import { centered, spacingIncrement } from '../../common-utils'

export type ButtonColors = {
  background?: keyof Color
  border?: keyof Color
  label?: keyof Color
  hoverLabel?: keyof Color
  hoverBackground?: keyof Color
  hoverBorder?: keyof Color
}

type StyleProps = {
  colors: FlattenInterpolation<ThemeProps<DefaultTheme>>
  sizeStyle: FlattenInterpolation<ThemeProps<DefaultTheme>>
  block?: boolean
  disabled?: boolean
}

export type ButtonProps = Omit<AButtonProps, 'size'> & {
  size?: 'base' | 'sm' | 'xs' // Custom Sizes
  type?: 'primary' | 'default' | 'ghost' | 'text'
  customColors?: ButtonColors
}

const IconWrapper = styled.div`
  ${centered};
`

const makeButtonStyle = ({
  colors,
  sizeStyle,
  disabled,
  block,
}: StyleProps): FlattenInterpolation<ThemeProps<DefaultTheme>> => css`
  align-items: center;
  border: solid 1px;
  display: flex;
  height: auto;
  justify-content: center;
  line-height: 1;
  transition: background-color 100ms ease-in-out, border-color 100ms ease-in-out;
  width: ${block ? '100%' : 'max-content'};
  ${sizeStyle}
  ${colors}
  ${disabled &&
  css`
    cursor: not-allowed;
    opacity: 0.6;
  `}
`

const Wrapper = styled.div<StyleProps>`
  &&& {
    .ant-btn,
    .ant-btn-primary,
    .ant-btn-text {
      ${makeButtonStyle}
    }
  }
`

const LinkWrapper = styled.div<StyleProps>`
  ${makeButtonStyle}
`

const Anchor = styled.a``

const Button: React.FC<ButtonProps> = ({
  children,
  type = 'primary',
  className,
  href,
  target,
  icon,
  download,
  customColors,
  size = 'base',
  disabled,
  block,
  ...props
}) => {
  const sizeStyles = useMemo(() => {
    switch (size) {
      case 'sm':
        return css`
          border-radius: ${({ theme }): string => theme.borderRadius.md};
          font-size: ${({ theme }): string => theme.fontSize.base};
          font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
          gap: ${spacingIncrement(8)};
          line-height: ${spacingIncrement(22)};
          padding: ${spacingIncrement(8)} ${spacingIncrement(12)};
        `
      case 'xs':
        return css`
          border-radius: ${({ theme }): string => theme.borderRadius.xs};
          font-size: ${({ theme }): string => theme.fontSize.sm};
          gap: ${spacingIncrement(4)};
          padding: ${spacingIncrement(4)} ${spacingIncrement(6)};
        `
      default:
        return css`
          border-radius: ${({ theme }): string => theme.borderRadius.base};
          font-size: ${({ theme }): string => theme.fontSize.base};
          font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
          gap: ${spacingIncrement(8)};
          padding: ${spacingIncrement(18)};
        `
    }
  }, [size])

  const colors = useMemo(() => {
    const { background, border, hoverBackground, hoverBorder, hoverLabel, label } =
      customColors ?? {}
    switch (type) {
      case 'primary':
        return css`
          background-color: ${({ theme }): string =>
            theme.color[disabled ? 'neutral12' : background ?? 'primary']};
          border-color: ${({ theme }): string =>
            theme.color[disabled ? 'neutral12' : border ?? 'primary']};
          color: ${({ theme }): string => theme.color[disabled ? 'neutral2' : label ?? 'white']};
          ${!disabled &&
          css`
            :hover {
              background-color: ${({ theme }): string =>
                theme.color[hoverBackground ?? 'darkPrimary']};
              border-color: ${({ theme }): string => theme.color[hoverBorder ?? 'darkPrimary']};
              color: ${({ theme }): string => theme.color[hoverLabel ?? 'white']};
            }
          `}
        `
      case 'ghost':
      case 'text':
        return css`
          ${type === 'ghost'
            ? css`
                background-color: ${({ theme }): string =>
                  theme.color[background ?? 'accentPrimary']};
                border-color: ${({ theme }): string => theme.color[border ?? 'accentPrimary']};
              `
            : css`
                border-color: transparent;
              `}
          color: ${({ theme }): string => theme.color[label ?? 'primary']};
          ${!disabled &&
          css`
            :hover {
              color: ${({ theme }): string => theme.color[hoverLabel ?? 'darkPrimary']};
            }
          `}
        `
      default:
        return css`
          background-color: ${({ theme }): string =>
            theme.isDarkMode ? theme.color[background ?? 'neutral7'] : 'transparent'};
          border-color: ${({ theme }): string =>
            theme.isDarkMode
              ? theme.color[border ?? 'neutral7']
              : theme.color[border ?? 'primary']};
          color: ${({ theme }): string => theme.color[label ?? 'primaryWhite']};
          ${!disabled &&
          css`
            :hover {
              background-color: ${({ theme }): string =>
                theme.isDarkMode
                  ? theme.color[hoverBackground ?? 'accentPrimary']
                  : theme.color[hoverBackground ?? 'accentPrimary']};
              border-color: ${({ theme }): string =>
                theme.isDarkMode
                  ? theme.color[hoverBorder ?? 'accentPrimary']
                  : theme.color[hoverBorder ?? 'darkPrimary']};
            }
          `}
        `
    }
  }, [type, disabled, customColors])

  const component = (
    <Wrapper
      className={className}
      colors={colors}
      sizeStyle={sizeStyles}
      block={block}
      disabled={disabled}
    >
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <AButton disabled={disabled} type={type} icon={icon} download={download} {...props}>
        {children}
      </AButton>
    </Wrapper>
  )

  // disabled property isn't supported on HTML anchor elements, fallback to button
  if (href && !disabled) {
    return (
      <Link href={href} passHref>
        <Anchor
          type={type}
          className={className}
          target={target}
          download={download}
          rel={target === '_blank' ? 'noopener noreferrer' : ''}
        >
          <LinkWrapper colors={colors} block={block} sizeStyle={sizeStyles}>
            {icon ? <IconWrapper>{icon}</IconWrapper> : null}
            {children}
          </LinkWrapper>
        </Anchor>
      </Link>
    )
  }

  return component
}

export default Button

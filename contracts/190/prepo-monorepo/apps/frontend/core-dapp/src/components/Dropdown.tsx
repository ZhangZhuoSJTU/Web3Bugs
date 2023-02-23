import { Dropdown as ADropdown, DropDownProps } from 'antd'
import styled, {
  Color,
  css,
  DefaultTheme,
  FlattenInterpolation,
  ThemeProps,
} from 'styled-components'
import { centered, spacingIncrement, media, Icon } from 'prepo-ui'

type CustomStyles = {
  backgroundColor?: keyof Color
  borderColor?: keyof Color
}

type Props = {
  customStyles?: CustomStyles
  label?: string
  variant?: 'standard' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  hideArrow?: boolean
}

const variantStandardStyles = (
  customStyles?: CustomStyles
): FlattenInterpolation<ThemeProps<DefaultTheme>> => css`
  background-color: ${({ theme }): string =>
    theme.color[customStyles?.backgroundColor || 'neutral7']};
  border: ${({ theme }): string =>
    customStyles?.borderColor ? `solid 1px ${theme.color[customStyles.borderColor]}` : '0'};
  border-radius: 3px;
  color: ${({ theme }): string => theme.color.neutral1};
`

const variantOutlineStyles = (
  customStyles?: CustomStyles
): FlattenInterpolation<ThemeProps<DefaultTheme>> => css`
  background-color: ${({ theme }): string =>
    theme.color[customStyles?.backgroundColor || 'neutral9']};
  border: 1px solid ${({ theme }): string => theme.color[customStyles?.borderColor || 'neutral8']};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  color: ${({ theme }): string => theme.color.secondary};
`

const sizeSmallStyles = css`
  font-size: ${({ theme }): string => theme.fontSize.xs};
  height: ${spacingIncrement(32)};
`

const sizeMediumStyles = css`
  font-size: ${({ theme }): string => theme.fontSize.base};
  height: ${spacingIncrement(54)};
`

const sizeLargeStyles = css`
  font-size: ${({ theme }): string => theme.fontSize.xl};
  height: ${spacingIncrement(69)};
`

const DropdownButton = styled.div<Props>`
  ${centered}
  ${({ customStyles, variant }): FlattenInterpolation<ThemeProps<DefaultTheme>> =>
    variant === 'outline'
      ? variantOutlineStyles(customStyles)
      : variantStandardStyles(customStyles)}
  ${({ size }): FlattenInterpolation<ThemeProps<DefaultTheme>> => {
    if (size === 'md') {
      return sizeMediumStyles
    }
    if (size === 'lg') {
      return sizeLargeStyles
    }
    return sizeSmallStyles
  }}
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  line-height: 20px;
  padding: ${spacingIncrement(12)} ${spacingIncrement(16)};
  :hover {
    cursor: pointer;
  }
`

const Content = styled.div`
  flex: 1;
`

const Label = styled.p`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: ${spacingIncrement(8)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.base};
  `}
`

const Wrapper = styled.div``

const Dropdown: React.FC<DropDownProps & Props> = ({
  children,
  customStyles,
  label,
  variant = 'standard',
  size = 'sm',
  hideArrow = false,
  ...props
}) => (
  <Wrapper>
    {Boolean(label) && <Label>{label}</Label>}
    {/* eslint-disable-next-line react/jsx-props-no-spreading */}
    <ADropdown trigger={['click']} {...props}>
      <DropdownButton customStyles={customStyles} variant={variant} size={size}>
        <Content>{children}</Content>
        {!hideArrow && <Icon name="arrow-down" height="24" width="24" />}
      </DropdownButton>
    </ADropdown>
  </Wrapper>
)

export default Dropdown

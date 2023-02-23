import { Dropdown as ADropdown, DropDownProps } from 'antd'
import { useMemo } from 'react'
import styled, { css, FlattenSimpleInterpolation } from 'styled-components'
import { spacingIncrement } from '../../common-utils'
import Icon from '../Icon'

type Props = {
  block?: boolean
  iconHeight?: number
  iconWidth?: number
  size?: 'base' | 'sm'
}

const StyledDropdown = styled(ADropdown)<DropDownProps>``

const Handler = styled.button<{
  block?: boolean
  visible?: boolean
  sizes: FlattenSimpleInterpolation
}>`
  align-items: center;
  background-color: ${({ theme, visible }): string =>
    theme.color[visible ? 'neutral7' : 'transparent']};
  border: solid 1px ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({ theme: { borderRadius } }): string => borderRadius.md};
  color: ${({ theme }): string => theme.color.neutral1};
  cursor: pointer;
  display: flex;
  gap: ${spacingIncrement(8)};
  justify-content: space-between;
  line-height: 1;
  padding: ${spacingIncrement(8)} ${spacingIncrement(11)};
  ${({ sizes }): FlattenSimpleInterpolation => sizes}
  ${({ block }): string => (block ? 'width: 100%;' : '')}
  :hover {
    border-color: ${({ theme, visible }): string => theme.color[visible ? 'neutral7' : 'neutral5']};
  }
`

const Dropdown: React.FC<Props & DropDownProps> = ({
  block,
  iconHeight = 16,
  iconWidth = 16,
  children,
  size,
  visible,
  ...props
}) => {
  const sizes = useMemo(() => {
    switch (size) {
      case 'sm':
        return css`
          height: ${spacingIncrement(40)};
          padding: ${spacingIncrement(8)} ${spacingIncrement(11)};
        `
      default:
        return css`
          height: ${spacingIncrement(60)};
          padding: ${spacingIncrement(16)};
        `
    }
  }, [size])

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <StyledDropdown visible={visible} {...props}>
      <Handler block={block} sizes={sizes} visible={visible}>
        {children}
        <Icon
          name={visible ? 'chevron-up' : 'chevron-down'}
          width={spacingIncrement(iconWidth)}
          height={spacingIncrement(iconHeight)}
          color="neutral1"
        />
      </Handler>
    </StyledDropdown>
  )
}

export default Dropdown

import React, { ReactNode, forwardRef } from 'react'
import styled from 'styled-components'
import { media } from '../utils/media'

type BorderConfig = 'none' | 'always'

interface MultiSelectItemProps {
  itemKey: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  borderConfig?: BorderConfig
}

const MultiSelectItemWrapper = styled.div<MultiSelectItemProps>`
  align-items: center;
  border: ${({ selected, theme }): string =>
    selected ? `1px solid ${theme.colors.textPrimary}` : `1px solid ${theme.colors.subtitle}`};
  ${({ borderConfig, selected }): string => {
    if (borderConfig === 'none' || (borderConfig !== 'always' && !selected))
      return `border-color: transparent;`
    return ''
  }}
  border-radius: 0.5rem;
  box-shadow: ${({ selected, borderConfig, theme }): string =>
    selected && borderConfig !== 'none' ? `0 0 0 4px ${theme.colors.primaryLight}` : '0'};
  color: ${({ selected, theme }): string =>
    selected ? theme.colors.textPrimary : theme.colors.subtitle};
  cursor: ${({ onClick }): string => (onClick ? 'pointer' : 'default')};
  display: flex;
  flex: 1;
  font-weight: ${({ selected }): string => (selected ? 'bold' : 'normal')};
  height: 100%;
  justify-content: center;
  padding: 0.1rem 0.6rem;
  transition: all 0.1s;
  transition-timing-function: ease;

  ${media.md`
    text-align: center;
  `}
`

const MultiSelectWrapper = styled.div`
  align-items: center;
  background-color: ${({ theme }): string => theme.colors.foreground};
  border-color: ${({ theme }): string => theme.colors.accent};
  border-radius: 0.5rem;
  border-style: solid;
  border-width: 1px;
  display: inline-flex;
`

interface MultiSelectProps {
  selectedKey: string
}

export const MultiSelectItem: React.FC<MultiSelectItemProps> = forwardRef<
  HTMLDivElement,
  MultiSelectItemProps
>(({ children, ...props }, ref) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <MultiSelectItemWrapper ref={ref} {...props}>
    {children}
  </MultiSelectItemWrapper>
))

MultiSelectItem.displayName = 'MultiSelectItem'

export const MultiSelect: React.FC<MultiSelectProps> = ({ children, selectedKey, ...props }) => {
  const childrenWithKey = React.Children.map(children, (child: ReactNode) => {
    if (React.isValidElement(child)) {
      const childProps: MultiSelectItemProps = child.props as MultiSelectItemProps
      return React.cloneElement(child, {
        selected: childProps.itemKey === selectedKey,
      })
    }
    return child
  })

  // eslint-disable-next-line react/jsx-props-no-spreading
  return <MultiSelectWrapper {...props}>{childrenWithKey}</MultiSelectWrapper>
}

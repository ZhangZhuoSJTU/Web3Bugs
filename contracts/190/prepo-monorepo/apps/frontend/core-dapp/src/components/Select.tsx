import styled, { Color, css, Weight, DefaultTheme } from 'styled-components'
import { Select as ASelect, SelectProps as ASelectProps } from 'antd'
import { coreDappTheme, spacingIncrement, Icon, IconName } from 'prepo-ui'
import { DefaultOptionType } from 'antd/lib/select'
import IconTitle from './IconTitle'

const { borderRadius } = coreDappTheme

type SelectStyles = {
  arrowColor?: keyof Color
  color?: keyof Color
  fontWeight?: keyof Weight
  fontSize?: keyof DefaultTheme['fontSize']
}

type OptionWithIconProps = {
  iconName: IconName
  id: string
  name: string
}

export type SelectProps = ASelectProps<string> & {
  hasDescription?: boolean
  iconOptions?: OptionWithIconProps[]
  override?: React.ReactNode
  styles?: SelectStyles
}

const removeBorder = css`
  border-color: ${({ theme }): string => theme.color.primary};
  box-shadow: none;
`

const SelectWrapper = styled.div<{ hasDescription: boolean; styles: SelectStyles }>`
  align-items: center;
  border-left: none;
  display: flex;

  &&& {
    .ant-select-selector {
      background-color: transparent;
      border: none;
      color: ${({ styles, theme }): string => theme.color[styles.color || 'neutral1']};
      font-weight: ${({ styles, theme }): number =>
        theme.fontWeight[styles.fontWeight || 'semiBold']};
      font-size: ${({ styles, theme }): string => theme.fontSize[styles.fontSize || 'base']};
    }

    .ant-select-focused:not(.ant-select-disabled).ant-select:not(.ant-select-customize-input)
      .ant-select-selector {
      ${removeBorder};
    }

    .ant-select-selection-search {
      right: ${spacingIncrement(49)};
    }

    .ant-select-selection-item {
      padding-right: ${spacingIncrement(38)};
    }

    .ant-select-arrow {
      color: ${({ styles, theme }): string => theme.color[styles.arrowColor || 'neutral5']};
      height: max-content;
      margin-top: unset;
      padding: 0px 11px;
      right: 0;
      transform: translateY(-50%);
      width: max-content;
    }
  }
`

export const { Option } = ASelect

const defaultDropdownStyles = {
  borderRadius: borderRadius.xs,
  padding: 0,
}

const Select: React.FC<SelectProps> = ({
  children,
  dropdownStyle = defaultDropdownStyles,
  iconOptions,
  hasDescription = false,
  options,
  override,
  styles = {},
  ...props
}) => {
  const transformIcons = (optionsWithIcon: OptionWithIconProps[]): DefaultOptionType[] =>
    optionsWithIcon.map(({ iconName, id, name }) => ({
      value: id,
      label: iconName ? (
        <IconTitle iconName={iconName} color="neutral1" weight="medium">
          {name}
        </IconTitle>
      ) : (
        name
      ),
    }))

  return (
    <SelectWrapper hasDescription={hasDescription} styles={styles}>
      {override || (
        <ASelect
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...props}
          options={iconOptions ? transformIcons(iconOptions) : options}
          dropdownStyle={dropdownStyle}
          suffixIcon={<Icon name="arrow-down" color="neutral5" height="24" width="24" />}
        >
          {children}
        </ASelect>
      )}
    </SelectWrapper>
  )
}

export default Select

import { DefaultOptionType } from 'antd/lib/select'
import { AutoComplete, AutoCompleteProps, Input } from 'antd'
import styled, { css } from 'styled-components'
import { spacingIncrement, media, Icon, centered } from 'prepo-ui'
import useResponsive from '../hooks/useResponsive'

export type SearchProps = AutoCompleteProps & {
  placeholder: string
  autoCompleteOptions: DefaultOptionType[]
}

const selectedDropdownStyle = css`
  color: ${({ theme }): string => theme.color.secondary};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
`

const IconWrapper = styled(Icon)`
  ${centered}
  padding-left: ${spacingIncrement(4)};
`

export const dropdownStyles = css`
  .ant-select-dropdown {
    background-color: ${({ theme }): string => theme.color.neutral9};
    .ant-select-item-option-selected,
    .ant-select-item-option-active {
      background-color: ${({ theme }): string => theme.color.neutral9};
      :hover {
        ${selectedDropdownStyle}
      }
    }
    .ant-select-item-option {
      font-size: ${({ theme }): string => theme.fontSize.xs};
      color: ${({ theme }): string => theme.color.neutral2};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.base};
      `}
      :hover {
        ${selectedDropdownStyle}
      }
    }
    .ant-select-item-option.ant-select-item-option-selected {
      ${selectedDropdownStyle}
    }
  }
`

const Wrapper = styled.div`
  &&&& {
    .ant-select.ant-select-auto-complete {
      width: 100%;
      .ant-input-affix-wrapper.ant-select-selection-search-input {
        background-color: ${({ theme }): string => theme.color.accent1};
        border: 1px solid ${({ theme }): string => theme.color.accent1};
        border-radius: ${({ theme }): string => theme.borderRadius.xs};
        height: ${spacingIncrement(38)};
        ${media.desktop`
          height: ${spacingIncrement(54)};
        `}
        .ant-input {
          background-color: transparent;
          color: ${({ theme }): string => theme.color.secondary};
          font-size: ${({ theme }): string => theme.fontSize.xs};
          line-height: 1;
          ${media.desktop`
            font-size: ${({ theme }): string => theme.fontSize.base};
          `}
          margin-left: ${spacingIncrement(10)};
          ::placeholder {
            color: ${({ theme }): string => theme.color.neutral2};
          }
          ::selection {
            background-color: ${({ theme }): string => theme.color.primary};
            color: ${({ theme }): string => theme.color.white};
          }
        }
      }
      .ant-input-affix-wrapper.ant-select-selection-search-input.ant-input-affix-wrapper-focused {
        border: 1px solid ${({ theme }): string => theme.color.primary};
        box-shadow: none;
      }
    }
  }
`

const Search: React.FC<SearchProps> = ({
  placeholder,
  autoCompleteOptions,
  onSelect,
  ...props
}) => {
  const filterOptions = ({ label, value }: DefaultOptionType): boolean => {
    if (!props.value) return true
    const labelString = label?.toString() ?? ''
    const valueString = value?.toString() ?? ''
    const searchValue = props.value.toLowerCase()
    return labelString.includes(searchValue) || valueString.includes(searchValue)
  }

  const options = autoCompleteOptions.filter(filterOptions)

  const { isDesktop } = useResponsive()

  let searchIconSize = '16'
  if (isDesktop) {
    searchIconSize = '21'
  }

  return (
    <Wrapper>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <AutoComplete onSelect={onSelect} options={options} {...props}>
        <Input
          placeholder={placeholder}
          prefix={
            <IconWrapper
              name="search"
              color="primaryLight"
              height={searchIconSize}
              width={searchIconSize}
            />
          }
        />
      </AutoComplete>
    </Wrapper>
  )
}

export default Search

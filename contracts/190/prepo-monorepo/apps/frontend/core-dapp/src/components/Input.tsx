/* eslint-disable react/jsx-props-no-spreading */
import { useState, FocusEvent, forwardRef } from 'react'
import { Input as AInput, InputProps, InputRef } from 'antd'
import styled, { Color, css, Weight } from 'styled-components'
import { spacingIncrement, media } from 'prepo-ui'
import Select, { SelectProps } from './Select'

type CustomStyles = {
  backgroundColor?: keyof Color
  borderColor?: keyof Color
  rounded?: boolean
}

export const largeInputStyles = css`
  font-size: ${({ theme }): string => theme.fontSize.md};
  padding: ${spacingIncrement(13)} ${spacingIncrement(24)};
`

export const middleInputStyles = css`
  font-size: ${({ theme }): string => theme.fontSize.base};
  padding: ${spacingIncrement(6)} ${spacingIncrement(12)};
`

export const smallInputStyles = css`
  font-size: ${({ theme }): string => theme.fontSize.xs};
  padding: ${spacingIncrement(3)} ${spacingIncrement(6)};
`

const Wrapper = styled.div`
  &&& {
    .ant-input {
      background-color: inherit;
      border: none;
      box-shadow: none;
      color: ${({ theme }): string => theme.color.secondary};
      font-size: ${({ theme }): string => theme.fontSize.xs};
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
      ::placeholder {
        color: ${({ theme }): string => theme.color.neutral2};
      }

      ${middleInputStyles};
    }

    .ant-input-sm {
      ${smallInputStyles};
    }
    .ant-input-lg {
      ${largeInputStyles};
    }

    .ant-input-disabled {
      cursor: default;
    }

    .ant-input-affix-wrapper {
      background-color: inherit;
      border: 1px solid ${({ theme }): string => theme.color.neutral8};
    }

    .ant-input-affix-wrapper-focused {
      box-shadow: 0 0 0 2px ${({ theme }): string => theme.color.primaryLight};
    }

    .ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled):hover {
      border-color: ${({ theme }): string => theme.color.primaryLight};
    }
  }
`

const InputLabelWrapper = styled.div`
  background-color: inherit;
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.md};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  line-height: 1.575;
  padding: ${spacingIncrement(13)} ${spacingIncrement(24)};
  width: 100%;
`

const Container = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`

const DescriptionWrapper = styled.div<{ inputIsFocused: boolean }>`
  border: none;
  color: ${({ theme }): string => theme.color.neutral1};
  padding: ${spacingIncrement(13)} ${spacingIncrement(24)};
  padding-top: 0;
  transition: all 0.3s;
`

const LabelContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`

export const LabelWrapper = styled.span<{ weight?: keyof Weight }>`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme, weight }): number =>
    weight ? theme.fontWeight[weight] : theme.fontWeight.regular};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}

  margin-bottom: ${spacingIncrement(10)};
`

const ClearLabel = styled.span`
  &&& {
    color: ${({ theme }): string => theme.color.error};
    cursor: pointer;
    font-size: ${({ theme }): string => theme.fontSize.xs};
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.base};
    `}

    margin-bottom: ${spacingIncrement(10)};
  }
`

const InputContainer = styled.div<{ customStyles?: CustomStyles }>`
  background-color: ${({ customStyles, theme }): string =>
    theme.color[customStyles?.backgroundColor || 'neutral9']};
  border: 1px solid
    ${({ customStyles, theme }): string => theme.color[customStyles?.borderColor || 'neutral8']};
  border-radius: ${({ customStyles, theme }): string =>
    customStyles?.rounded ? theme.borderRadius.base : '0'};
  transition: border 0.3s;
  :focus-within {
    border: 1px solid ${({ theme }): string => theme.color.primary};
  }
`

type Props = InputProps & {
  className?: string
  renderRight?: React.ReactNode
  renderLeft?: React.ReactNode
  renderInputAsLabel?: React.ReactNode
  selectOptions?: SelectProps
  description?: React.ReactNode
  primaryLabel?: React.ReactNode
  secondaryLabel?: string | React.ReactNode
  customStyles?: CustomStyles
  onClear?: () => void
}

const Input: React.ForwardRefRenderFunction<InputRef, Props> = (
  {
    className,
    renderLeft,
    renderRight,
    renderInputAsLabel,
    selectOptions,
    description,
    primaryLabel,
    secondaryLabel,
    onFocus,
    onBlur,
    size = 'large',
    customStyles,
    onClear,
    ...props
  },
  ref
) => {
  const [inputIsFocused, setInputIsFocused] = useState<boolean>(false)

  const onFocusMiddleware = (e: FocusEvent<HTMLInputElement>): void => {
    setInputIsFocused(true)
    if (onFocus) {
      onFocus(e)
    }
  }

  const onBlurMiddlware = (e: FocusEvent<HTMLInputElement>): void => {
    setInputIsFocused(false)
    if (onBlur) {
      onBlur(e)
    }
  }

  return (
    <Wrapper className={className}>
      <LabelContainer>
        <LabelWrapper weight="medium">{primaryLabel}</LabelWrapper>
        {onClear ? (
          <ClearLabel onClick={onClear}>Clear</ClearLabel>
        ) : (
          <LabelWrapper weight="medium">{secondaryLabel}</LabelWrapper>
        )}
      </LabelContainer>
      <InputContainer customStyles={customStyles}>
        <Container>
          {renderLeft}
          {renderInputAsLabel ? (
            <InputLabelWrapper>{renderInputAsLabel}</InputLabelWrapper>
          ) : (
            <AInput
              size={size}
              onFocus={onFocusMiddleware}
              onBlur={onBlurMiddlware}
              {...props}
              ref={ref}
            />
          )}
          {selectOptions && <Select {...selectOptions} />}
          {renderRight}
        </Container>
        {description && (
          <DescriptionWrapper inputIsFocused={inputIsFocused}>{description}</DescriptionWrapper>
        )}
      </InputContainer>
    </Wrapper>
  )
}

export default forwardRef(Input)

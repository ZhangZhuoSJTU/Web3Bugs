/* eslint-disable react/jsx-props-no-spreading */
import React, { forwardRef } from 'react'
import styled, { css, DefaultTheme, FlattenInterpolation, ThemeProps } from 'styled-components'
import { Input as AntInput, InputProps } from 'antd'
import { spacingIncrement } from '../features/app/themes'
import { media } from '../utils/media'

const inputStyles = css`
  background-color: ${({ theme }): string => theme.colors.foreground};
  border-color: ${({ theme }): string => theme.colors.accent};
  border-radius: ${spacingIncrement(1.5)};
  display: flex;
  font-size: ${({ theme }): string => theme.fontSize.xl};
  font-weight: bold;
  justify-content: flex-end;
  padding-left: ${spacingIncrement(2)};
  transition: all 0.1s ease;
`

const topLabelStyle = css`
  height: ${spacingIncrement(6.625)};

  .ant-input-prefix {
    background: white none repeat scroll 0 0;
    border-color: ${({ theme }): string => theme.colors.accentLight};
    color: ${({ theme }): string => theme.colors.subtitle};
    font-size: ${({ theme }): string => theme.fontSize.sm};
    font-weight: normal;
    height: auto;
    left: 20px;
    line-height: 10px;
    padding: 0 0.5rem;
    position: absolute;
    top: -5px;
    width: auto;
    z-index: 1;

    ${media.lg`
      left: 8px;
      padding: 0 0.2rem;
      font-size: ${({ theme }): string => theme.fontSize.xsm};
    `}
  }

  .ant-input-affix-wrapper {
    padding: 0;
  }

  input {
    border-radius: 0.75rem;
    font-size: ${({ theme }): string => theme.fontSize.lgx};
  }
`

const defaultLabelStyle = css`
  height: ${spacingIncrement(8.5)};

  .ant-input-prefix {
    color: ${({ theme }): string => theme.colors.accent};
    display: flex;
    font-size: ${({ theme }): string => theme.fontSize.base};
    ${media.lg`
        display: none;
    `};
  }

  .ant-input-affix-wrapper {
    padding: 0 2rem;
  }

  input {
    font-size: ${({ theme }): string => theme.fontSize.xl};
  }
`

type WrapperProps = {
  highlight: boolean
  topLabel: boolean
  textCentered: boolean
  labelColor: 'textPrimary' | 'accent'
}

const Wrapper = styled.div<WrapperProps>`
  .ant-input {
    ${inputStyles};
    color: ${({ theme, labelColor }): string => theme.colors[labelColor]};

    text-align: ${({ textCentered }): string => (textCentered ? 'center' : 'right')};
  }

  .ant-input-affix-wrapper {
    ${inputStyles};

    :not(.ant-input-affix-wrapper-disabled):hover,
    :focus {
      border-color: ${({ theme }): string => theme.colors.primary};
      box-shadow: 0 0 0 2px ${({ theme }): string => theme.colors.primaryLight};
    }

    ${({ theme, highlight }): string => {
      if (highlight) return `border: 2px solid ${theme.colors.primary};`
      return ''
    }}

    input {
      font-weight: bold;
      text-align: ${({ textCentered }): string => (textCentered ? 'center' : 'right')};
    }
  }

  span {
    height: 100%;
  }

  ${({ topLabel }): FlattenInterpolation<ThemeProps<DefaultTheme>> =>
    topLabel ? topLabelStyle : defaultLabelStyle}
`

type SupportedFormatValue = 'dollars' | 'percentage'

type Value = string | number | readonly string[] | undefined

type Props = InputProps & {
  highlight?: boolean
  formatValue?: SupportedFormatValue
  topLabel?: boolean
  className?: string
  textCentered?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref?: any // TODO - fix TS
}

const formatValueToDollars = (dollars: Value): string => {
  if (dollars === '0' || !dollars) return '$0'
  const separator = ','
  const inputValue = dollars as string

  const formattedDollars = inputValue
    .replace(/\D*/g, '') // replace non-numbers
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator) // insert commas
    .replace(/^0+/, '') // remove leading zeros

  return `$${formattedDollars}`
}

const formatValuePercentage = (percentage: Value): string => {
  if (percentage === '0' || !percentage) return '0%'

  const inputValue = percentage as string
  const formattedPercentage = inputValue
    .replace(/\D*/g, '') // replace non-numbers
    .replace(/^0+/, '') // remove leading zeros

  return `${formattedPercentage}%`
}

const getInputFormat = (
  value: Value,
  formatValue: SupportedFormatValue | undefined
): Value | string => {
  if (formatValue === 'dollars') {
    return formatValueToDollars(value)
  }
  if (formatValue === 'percentage') {
    return formatValuePercentage(value)
  }

  return value
}

const Input: React.FC<Props> = forwardRef(
  (
    {
      className,
      textCentered = false,
      highlight = false,
      value,
      formatValue,
      topLabel = false,
      ...props
    },
    ref
  ) => {
    const inputValue = getInputFormat(value, formatValue)
    const labelColor = value !== '0' ? 'textPrimary' : 'accent'
    return (
      <Wrapper
        textCentered={textCentered}
        className={className}
        highlight={highlight}
        topLabel={topLabel}
        labelColor={labelColor}
      >
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore */}
        <AntInput ref={ref} value={inputValue} {...props} />
      </Wrapper>
    )
  }
)

Input.displayName = 'Input'

export default Input

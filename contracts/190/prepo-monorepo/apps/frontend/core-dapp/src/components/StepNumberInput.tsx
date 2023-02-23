import { useState, useMemo, useCallback } from 'react'
import styled, { css, DefaultTheme, FlattenInterpolation, ThemeProps } from 'styled-components'
import { Input, Row } from 'antd'
import { centered, media, spacingIncrement, Icon } from 'prepo-ui'

const Wrapper = styled.div`
  ${centered}
  flex: 1;
  flex-direction: row;
`

const StyledInput = styled(Input)`
  ${centered}
  background-color: transparent;
  border: 0;
  color: ${({ theme }): string => theme.color.secondary};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  margin: 0;
  padding: 0;
  text-align: center;
  :focus {
    box-shadow: none;
    outline: none;
  }
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
`

const Contents = styled(Row)`
  &&& {
    ${centered}
    border-radius: 0.5rem;
    flex: 1;
    height: ${spacingIncrement(30)};
  }
`

const IconWrapper = styled.div<{ disabled?: boolean }>`
  ${centered}
  ${({ theme, disabled }): FlattenInterpolation<ThemeProps<DefaultTheme>> =>
    disabled
      ? css`
          background-color: unset;
          cursor: not-allowed;
          opacity: 0.25;
        `
      : css`
          background-color: ${theme.color.primaryAccent};
          cursor: pointer;
          opacity: 1;
        `}
  border-radius: 2px;
  height: ${spacingIncrement(26)};
  width: ${spacingIncrement(26)};
`

type Props = {
  addStep?: number
  format?: (value: number) => string
  max?: number
  min?: number
  minusStep?: number
  onChange?: (value: number) => void
  step?: number
  value: number
  disabled?: boolean
}

const StepNumberInput: React.FC<Props> = ({
  addStep,
  format,
  max,
  min = 0,
  minusStep,
  onChange,
  step = 1,
  value,
  disabled = false,
}) => {
  const [selectedInput, setSelectedInput] = useState(false)

  const disableMinus = useMemo(
    () => disabled || (min !== undefined ? min >= value : false),
    [disabled, min, value]
  )

  const disablePlus = useMemo(
    () => disabled || (max !== undefined ? max <= value : false),
    [disabled, max, value]
  )

  const getValueInRange = useCallback(
    (newValue: string): number => {
      if (!newValue) return min === undefined ? 0 : min
      const val = parseInt(newValue, 10)
      if (max !== undefined && val > max) return max
      if (min !== undefined && val < min) return min
      return val
    },
    [max, min]
  )

  const handleOnBlur = (): void => {
    setSelectedInput(false)
  }

  const handleOnChange = (newValue: string): void => {
    if (/^[0-9.]*$/.test(newValue)) {
      const val = getValueInRange(newValue)
      onChange?.(val)
    }
  }

  const handleDecrement = (): void => {
    let change = minusStep || step
    const difference = value - min
    if (difference < change) {
      change = difference
    }
    onChange?.(value - change)
  }

  const handleOnFocus = (): void => {
    setSelectedInput(true)
  }

  const handleIncrement = (): void => {
    // if value is for example 99.5, max is 100, and step is 1
    // we need to add only 0.5 and not 1
    let change = addStep || step
    const difference = (max || value) - value
    if (difference < change) {
      change = difference
    }
    onChange?.(value + change)
  }

  const formattedValue = format ? format(value) : value
  return (
    <Wrapper>
      <IconWrapper
        disabled={disableMinus}
        onClick={(): void | false => !disableMinus && handleDecrement()}
      >
        <Icon name="minus" height="13" width="13" color="secondary" />
      </IconWrapper>
      <Contents>
        <StyledInput
          disabled={disabled}
          onBlur={handleOnBlur}
          onChange={(e): false | void => handleOnChange(e.target.value)}
          onFocus={handleOnFocus}
          value={selectedInput ? value : formattedValue}
        />
      </Contents>
      <IconWrapper
        disabled={disablePlus}
        onClick={(): void | false => !disablePlus && handleIncrement()}
      >
        <Icon name="plus" height="13" width="13" color="secondary" />
      </IconWrapper>
    </Wrapper>
  )
}

export default StepNumberInput

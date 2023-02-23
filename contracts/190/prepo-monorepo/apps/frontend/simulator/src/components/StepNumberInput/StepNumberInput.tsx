import React, { useState, useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Col, Input, Row } from 'antd'
import { getCalculationVariables } from './step-number-input-utils'
import { percentToFloat } from '../../helpers'
import ButtonIcon from '../ButtonIcon'
import { spacingIncrement } from '../../features/app/themes'

const StyledInput = styled(Input)`
  && {
    align-items: center;
    border: 0;
    color: black;
    display: flex;
    font-size: ${({ theme }): string => theme.fontSize.xsm};
    font-weight: bold;
    height: 1.2rem;
    margin: 0;
    margin-left: ${spacingIncrement(1)};
    padding: 0;
    text-align: center;
    width: 80%;
  }
`

const Value = styled.span`
  color: ${({ theme }): string => theme.colors.textPrimary};
  font-size: ${({ theme }): string => theme.fontSize.xsm};
  font-weight: bold;
  margin-left: 0.5rem;
`

const Label = styled.span`
  color: ${({ theme }): string => theme.colors.accent};
  font-size: ${({ theme }): string => theme.fontSize.xsm};
  font-weight: bold;
`

const Contents = styled(Row)`
  text-align: center;
  width: 6rem;
  && {
    align-items: center;
    border: 1px solid ${({ theme }): string => theme.colors.accentLight};
    border-radius: 0.5rem;
    display: flex;
    flex: 1;
    height: 1.5rem;
    justify-content: center;
    margin: 0 0.25rem;
  }
`

const Wrapper = styled.div`
  align-items: center;
  display: flex;
  float: right;
`

type Props = {
  style?: React.CSSProperties
  onLeftButtonClick: (value: number) => void
  onRightButtonClick: (value: number) => void
  onCustomInput: (input: number) => void
  label: 'APR' | 'APY' | 'Fee'
  suffix: string
  value: string
  max: number
  min: number
}

const StepNumberInput: React.FC<Props> = ({
  style,
  onLeftButtonClick,
  onRightButtonClick,
  onCustomInput,
  label,
  suffix,
  value,
  max,
  min,
}) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const textInputRef: React.RefObject<Input> = useRef(null)
  const [selectedInput, setSelectedInput] = useState(false)
  const [customInputValue, setCustomInputValue] = useState(value)

  useEffect(() => {
    if (selectedInput && textInputRef && textInputRef.current) {
      textInputRef.current.input.focus()
    }
  }, [selectedInput, textInputRef])

  const handleLeftButtonClick = (): void => {
    const currentValue = percentToFloat(value)
    const calculationVariables = getCalculationVariables(label, currentValue, 'minus')
    const newValue = Math.max(0, currentValue - calculationVariables.STEP)

    onLeftButtonClick(newValue)
  }

  const handleRightButtonClick = (): void => {
    const currentValue = percentToFloat(value)
    const calculationVariables = getCalculationVariables(label, currentValue, 'plus')
    const newValue = Math.min(calculationVariables.MAX, currentValue + calculationVariables.STEP)

    onRightButtonClick(newValue)
  }

  const handleInputClick = (): void => {
    setSelectedInput(true)
  }

  function handleInputChange(newInput: string): void {
    const isValid = /^[0-9.]*$/.test(newInput)
    if (isValid) setCustomInputValue(newInput)
  }

  const finishedCustomInput = (): void => {
    setSelectedInput(false)
    const n = Number(customInputValue)
    // Bad custom input, reset it to last value
    if (Number.isNaN(n)) {
      setCustomInputValue(value)
      return
    }
    // Handle out of bound inputs
    if (n < min) {
      onCustomInput(min)
      setCustomInputValue(min.toString())
      return
    }
    if (n > max) {
      onCustomInput(max / 100)
      setCustomInputValue(max.toString())
      return
    }

    // Valid custom input
    onCustomInput(n / 100)
    setCustomInputValue(n.toString())
  }

  return (
    <Wrapper style={style}>
      <ButtonIcon icon="minus" onClick={handleLeftButtonClick} />
      <Contents onClick={handleInputClick}>
        <Col xs={10}>
          <Label>{label}</Label>
        </Col>
        <Col xs={14}>
          {selectedInput ? (
            <StyledInput
              ref={textInputRef}
              value={customInputValue}
              onChange={(e): void => handleInputChange(e.target.value)}
              onPressEnter={finishedCustomInput}
              onBlur={finishedCustomInput}
            />
          ) : (
            <Value>
              {value}
              {suffix}
            </Value>
          )}
        </Col>
      </Contents>
      <ButtonIcon icon="plus" onClick={handleRightButtonClick} />
    </Wrapper>
  )
}

export default StepNumberInput

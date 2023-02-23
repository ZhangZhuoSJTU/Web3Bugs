import React, { useRef, useEffect } from 'react'
import styled from 'styled-components'
import { Input as AntdInput } from 'antd'
import { actions } from '../position/position-slice'
import { spacingIncrement } from '../app/themes'
import Input from '../../components/Input'
import { media } from '../../utils/media'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { MAX_DEPOSIT_AMOUNT } from '../../constants'

type WrapperProps = {
  show: boolean
}

const Wrapper = styled.div<WrapperProps>`
  margin-bottom: ${spacingIncrement(4)};

  ${media.lg`
    opacity: ${({ show }: WrapperProps): string => (show ? '1' : '0')};
    transition: transform 0.3s ease-in, opacity 0.3s ease-in;
  `}
`

const MobilePromptText = styled.div`
  display: none;
  font-weight: bold;
  margin-bottom: ${spacingIncrement(0.5)};
  ${media.lg`
    display: flex;
  `}
`

function parseUsd(dollars: string): number {
  return parseInt(dollars.replace(/\D*/g, ''), 10) // replace non-numbers
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
function keepCursorRight(inputEl: React.RefObject<AntdInput>): void {
  const shiftRight = (): void => {
    setTimeout(() => {
      inputEl?.current?.input.setSelectionRange(99999, 99990)
    }, 0)
  }
  if (inputEl && inputEl.current) {
    inputEl.current.input.onfocus = shiftRight
    inputEl.current.input.onclick = shiftRight
    inputEl.current.input.onkeydown = shiftRight
  }
}

const Deposit: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const inputEl = useRef<AntdInput>(null)
  const position = useAppSelector((state) => state.position)
  const dispatch = useAppDispatch()

  useEffect(() => {
    keepCursorRight(inputEl)
  }, [inputEl])

  const onChangeInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const num = parseUsd(e.target.value)
    if (Number.isNaN(num)) {
      dispatch(actions.sizeChanged(0))
    } else if (num > MAX_DEPOSIT_AMOUNT) {
      dispatch(actions.sizeChanged(MAX_DEPOSIT_AMOUNT))
    } else {
      dispatch(actions.sizeChanged(num))
    }

    if (!position.ui.hasEnteredDepositAmount) {
      dispatch(actions.enteredDepositAmount())
    }
  }

  const highlight = Boolean(position.market && !position.ui.hasEnteredDepositAmount)

  return (
    <Wrapper show={position.ui.hasCompletedEntryExit}>
      <MobilePromptText>I want to deposit...</MobilePromptText>
      <Input
        ref={inputEl}
        prefix="I want to deposit..."
        max={MAX_DEPOSIT_AMOUNT}
        value={position.size.toString()}
        formatValue="dollars"
        onChange={onChangeInput}
        disabled={!position.market}
        highlight={highlight}
      />
    </Wrapper>
  )
}

export default Deposit

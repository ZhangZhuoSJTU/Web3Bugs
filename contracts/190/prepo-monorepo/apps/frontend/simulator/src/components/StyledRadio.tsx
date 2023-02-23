/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable react/jsx-props-no-spreading */
import React, { createRef, useEffect } from 'react'
import styled from 'styled-components'
import scrollIntoView from 'smooth-scroll-into-view-if-needed'
import { Radio, RadioProps } from 'antd'
import { actions } from '../features/position/position-slice'
import { useAppDispatch, useAppSelector } from '../app/hooks'

export const MultiRadioContainer = styled.div`
  border-color: ${({ theme }): string => theme.colors.accent};
  border-radius: 0.5rem;
  border-style: solid;
  border-width: 1px;
  padding: 2px;
  > div {
    display: flex;
  }
`

const RadioWrapper = styled.div<{ active: boolean | undefined }>`
  background-color: ${({ theme, active }): string =>
    active ? theme.colors.primaryLight : theme.colors.foreground};
  border-radius: 0.5rem;
  margin-bottom: 0.4rem;
  padding: 4px;
  transition: all 0.1s;
  width: 50%;
`

type RadioVariant = 'radio' | 'card'

type Props = RadioProps & {
  variant?: RadioVariant
  shouldScroll?: boolean
}

const StyledAntdRadio = styled(Radio)<Props>`
  background-color: ${({ theme, checked, variant }): string =>
    checked || variant === 'card' ? theme.colors.foreground : theme.colors.background};
  border-color: ${({ theme }): string => theme.colors.accentLight};
  border-radius: 0.5rem;
  border-style: solid;
  border-width: ${({ checked }): string => (checked ? '2px' : '1px')};
  /* Stop height glitching when border gets 1px larger by adding 1px to padding when not checked */
  font-weight: ${({ checked }): string => (checked ? 'bold' : 'normal')};
  margin: 0;
  padding: ${({ checked }): string => (checked ? '0.75rem' : 'calc(0.75rem + 1px)')};
  transition: all 0.1s;
  transition-timing-function: ease;
  white-space: nowrap;
  width: 100%;

  &.ant-radio-wrapper-checked {
    border-color: ${({ theme }): string => theme.colors.textPrimary};
  }

  &.ant-radio-checked &.ant-radio-inner:focus {
    border-color: ${({ theme }): string => theme.colors.primary};
  }

  &.ant-radio-checked &.ant-radio-inner {
    border-color: ${({ theme }): string => theme.colors.primary};
  }
  &.ant-radio-checked &.ant-radio-inner:after {
    background-color: ${({ theme }): string => theme.colors.primary};
  }
  &.ant-radio-wrapper-disabled:hover {
    cursor: not-allowed;
  }

  .ant-radio {
    display: ${({ variant }): string => (variant === 'radio' ? 'inline block' : 'none')};
  }
`

const StyledRadio: React.FC<Props> = ({
  checked = false,
  onChange,
  disabled = false,
  variant = 'radio',
  children,
  ...props
}) => {
  const scrollToMarket = useAppSelector((state) => state.position.ui.scrollToMarket)
  const dispatch = useAppDispatch()
  const myRef = createRef<HTMLDivElement>()

  useEffect(() => {
    async function scrollIntoViewIfChecked(): Promise<void> {
      if (scrollToMarket && checked && myRef.current) {
        await scrollIntoView(myRef.current, {
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
        dispatch(actions.setScrollToMarket(false))
      }
    }
    scrollIntoViewIfChecked().finally(() => null)
  }, [dispatch, scrollToMarket, checked, myRef])

  return (
    <RadioWrapper ref={myRef} active={checked}>
      <StyledAntdRadio
        variant={variant}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      >
        {children}
      </StyledAntdRadio>
    </RadioWrapper>
  )
}

export default StyledRadio

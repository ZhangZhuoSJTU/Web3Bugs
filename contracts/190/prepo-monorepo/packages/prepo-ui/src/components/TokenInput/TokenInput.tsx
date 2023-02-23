// eslint-disable-next-line import/no-extraneous-dependencies
import { displayDecimals } from 'prepo-utils'
import Skeleton from 'react-loading-skeleton'
import React, { useCallback, useMemo } from 'react'
import styled from 'styled-components'
import Icon from '../Icon'
import { IconName } from '../Icon/icon.types'
import Input, { Alignment } from '../Input'
import Slider, { SliderValue } from '../Slider'
import { media, spacingIncrement } from '../../common-utils'
import useResponsive from '../../hooks/useResponsive'

type Props = {
  alignInput?: Alignment
  balance?: string
  connected?: boolean
  disabled?: boolean
  disableClickBalance?: boolean
  hideBalance?: boolean
  hideInput?: boolean
  iconName?: IconName
  label?: string
  onChange?: (value: string) => void
  max?: string
  shadowSuffix?: string
  showSlider?: boolean
  symbol?: string
  usd?: boolean
  value?: string
  balanceLabel?: string
}

const BalanceText = styled.p<{ $clickable?: boolean }>`
  color: ${({ theme }): string => theme.color.neutral4};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: 0;
  ${({ $clickable }): string => ($clickable ? 'cursor: pointer;' : '')}
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
  `}
  :hover {
    span {
      color: ${({ $clickable, theme }): string =>
        theme.color[$clickable ? 'primary' : 'secondary']};
    }
  }
`

const SemiboldText = styled.span`
  color: ${({ theme }): string => theme.color.secondary};
  font-size: inherit;
  font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
  ${media.desktop`
    font-size: inherit;
  `}
`

const FlexCenterWrapper = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacingIncrement(8)};
  ${media.desktop`
    gap: ${spacingIncrement(10)};
  `}
`

const CurrencyWrapper = styled(FlexCenterWrapper)`
  font-size: ${({ theme }): string => theme.fontSize.sm};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.lg};
  `}
`

const SliderWrapper = styled.div`
  margin: ${spacingIncrement(24)} 0;
`

const TokenInput: React.FC<Props> = ({
  alignInput,
  balance = '0',
  connected,
  disabled,
  disableClickBalance,
  hideBalance,
  hideInput,
  iconName,
  label = 'Amount',
  max = '0',
  onChange,
  shadowSuffix,
  showSlider,
  symbol = '',
  balanceLabel = 'Balance',
  usd,
  value,
}) => {
  const { isDesktop } = useResponsive()
  const canInteract = !disabled && connected
  const defaultValue = connected ? value ?? '' : ''
  const size = isDesktop ? '40' : '31'

  const handleClickBalance = useCallback((): void => {
    if (!disableClickBalance) {
      if (onChange) onChange(balance)
    }
  }, [balance, disableClickBalance, onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    try {
      if (onChange) onChange(e.target.value)
    } catch (error) {
      // invalid input
    }
  }

  // input with number type will allow +/- in the middle or at the end
  // the captured value will be '' but when setting that value, it will preserve the plus minus
  // e.g. if we enter 100++ and console log the `inputValue`, we will see '', and +inputValue will be 0
  // but when we setStringValue(inputValue), it will show 100++ in the input field
  // this handleKeyDown will prevent +/- sign from proceeding to `onChange`
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === '+' || e.key === '-') e.preventDefault()
  }

  const handleSliderChange = (e: SliderValue): void => {
    if (typeof e === 'number' && canInteract) {
      if (onChange) onChange(`${e}`)
    }
  }

  // balanceUI will show by default. If balance is undefined, it will assume it's loading
  // if we want to hide balance, use  hideBalance
  const balanceUI = useMemo(() => {
    if (hideBalance) return null
    if (balance === undefined && connected)
      return (
        <FlexCenterWrapper>
          <BalanceText>{balanceLabel}: </BalanceText>
          <Skeleton height={20} width={80} />
        </FlexCenterWrapper>
      )
    return (
      <BalanceText
        $clickable={canInteract && !disableClickBalance}
        onClick={(): void => {
          if (canInteract) handleClickBalance()
        }}
      >
        {balanceLabel}:&nbsp;
        <SemiboldText>
          {usd && '$'}
          {displayDecimals(balance)}&nbsp;
          {!usd && symbol}
        </SemiboldText>
      </BalanceText>
    )
  }, [
    hideBalance,
    balance,
    connected,
    balanceLabel,
    canInteract,
    disableClickBalance,
    usd,
    symbol,
    handleClickBalance,
  ])

  const tokenSymbol = useMemo(() => {
    if (!iconName && !symbol) return null
    return (
      <CurrencyWrapper>
        {iconName !== undefined && <Icon name={iconName} height={size} width={size} />}
        {symbol !== undefined && <SemiboldText>{symbol}</SemiboldText>}
      </CurrencyWrapper>
    )
  }, [iconName, size, symbol])

  return (
    <div>
      {!hideInput && (
        <Input
          alignInput={alignInput}
          disabled={!canInteract}
          label={label}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="0"
          prefix={tokenSymbol}
          secondaryLabel={balanceUI}
          shadowSuffix={shadowSuffix ?? (usd ? 'USD' : undefined)}
          step="0.01"
          type="number"
          value={defaultValue}
        />
      )}
      {showSlider && (
        <SliderWrapper>
          <Slider
            labelPosition="none"
            min={0}
            max={+max}
            onChange={handleSliderChange}
            step={+max > 1 ? 0.01 : 0.00001}
            thickness="small"
            thumbStyles={['circle', 'circle']}
            trackColor="primary"
            trackUnderlyingColor="neutral7"
            value={+defaultValue}
          />
        </SliderWrapper>
      )}
    </div>
  )
}

export default TokenInput

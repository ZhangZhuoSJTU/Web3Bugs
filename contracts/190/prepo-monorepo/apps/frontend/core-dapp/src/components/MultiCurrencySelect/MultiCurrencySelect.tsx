import { formatNumber } from 'prepo-utils'
import { observer } from 'mobx-react-lite'
import Skeleton from 'react-loading-skeleton'
import styled, { Color } from 'styled-components'
import { ChangeEvent, useMemo, useState } from 'react'
import { media } from 'prepo-ui'
import CurrencySelectionComponent from './CurrencySelectionComponent'
import Input from '../Input'
import useResponsive from '../../hooks/useResponsive'
import { useRootStore } from '../../context/RootStoreProvider'

type Props = {
  label?: React.ReactNode
  balance?: React.ReactNode
  disabled?: boolean
  inputValue?: number
  onInputChange?: (value: number) => void
  maxValue?: number
  minValue?: number
  nonInput?: boolean
  showBalance?: boolean
}

type StyledInputProps = {
  $isSingleCurrency?: boolean
}

const StyledInput = styled(Input)<StyledInputProps>`
  text-align: ${({ $isSingleCurrency }): string => ($isSingleCurrency ? 'right' : 'left')};
  ${media.tablet<StyledInputProps>`
    text-align: left;
  `}
`

const InputLabelWrapper = styled.div<StyledInputProps>`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.md};
  text-align: ${({ $isSingleCurrency }): string => ($isSingleCurrency ? 'right' : 'left')};
  ${media.tablet<StyledInputProps>`
    text-align: left;
  `}
`

const InputLabelSuffixWrapper = styled.span<{ color?: keyof Color }>`
  color: ${({ theme, color = 'neutral1' }): string => theme.color[color]};
`

const MediumText = styled.span`
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
`

const Boldtext = styled.span`
  font-weight: ${({ theme }): number => theme.fontWeight.bold};
`
type InputLabelSuffixProps = {
  currency?: string
  isSingleCurrency?: boolean
}

const InputLabelSuffix: React.FC<InputLabelSuffixProps> = ({ isSingleCurrency, currency }) => {
  if (isSingleCurrency) return null
  return (
    <span>
      <InputLabelSuffixWrapper>{` ${currency} `}</InputLabelSuffixWrapper>
      <InputLabelSuffixWrapper color="neutral5">
        <MediumText>(Multiple)</MediumText>
      </InputLabelSuffixWrapper>
    </span>
  )
}

const MultiCurrencySelect: React.FC<Props> = ({
  label = 'Amount',
  disabled,
  inputValue,
  onInputChange,
  maxValue,
  minValue,
  nonInput,
  showBalance,
}) => {
  const { isPhone } = useResponsive()
  const { currenciesStore, web3Store } = useRootStore()
  const { selectedCurrencies } = currenciesStore
  const { connected } = web3Store
  const [isFocus, setIsFocus] = useState(false)
  const verifyInputAmount = (e: ChangeEvent<HTMLInputElement>): void => {
    setIsFocus(false)
    const blurAmount = parseInt(e.target.value, 10)
    if (maxValue !== undefined && blurAmount > maxValue) {
      onInputChange?.(maxValue)
    }

    if (minValue !== undefined && blurAmount < minValue) {
      onInputChange?.(minValue)
    }
  }
  const onInputFocus = (): void => {
    setIsFocus(true)
  }
  const onChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const newAmount = parseInt(e.target?.value === '' ? '0' : e.target?.value, 10)
    onInputChange?.(newAmount)
  }

  const isSingleCurrency = useMemo(
    () => selectedCurrencies.length > 0 && selectedCurrencies.length === 1,
    [selectedCurrencies.length]
  )

  const balance = useMemo(() => {
    const currency = selectedCurrencies[0]
    if (!showBalance) return null
    // in the future we may want to handle summing up user's selected balances

    if (!connected) {
      return <span>Balance: 0 {currency.name}</span>
    }

    return (
      <span>
        Balance:{' '}
        {currency.balance === undefined ? (
          <Skeleton height={20} width={80} />
        ) : (
          <Boldtext>
            {formatNumber(currency.balance)} {currency.name}
          </Boldtext>
        )}
      </span>
    )
  }, [connected, selectedCurrencies, showBalance])

  return (
    <StyledInput
      $isSingleCurrency={isSingleCurrency}
      primaryLabel={label}
      secondaryLabel={balance}
      renderLeft={((isPhone && isSingleCurrency) || nonInput) && <CurrencySelectionComponent />}
      renderRight={
        !nonInput && (!isPhone || (isPhone && !isSingleCurrency)) && <CurrencySelectionComponent />
      }
      value={inputValue}
      renderInputAsLabel={
        !isFocus &&
        !isSingleCurrency && (
          <InputLabelWrapper onClick={onInputFocus} $isSingleCurrency={isSingleCurrency}>
            {inputValue}
            <InputLabelSuffix currency="USD" isSingleCurrency={isSingleCurrency} />
          </InputLabelWrapper>
        )
      }
      disabled={nonInput || disabled}
      onChange={onChange}
      onFocus={onInputFocus}
      size="large"
      onBlur={verifyInputAmount}
      autoFocus
    />
  )
}

export default observer(MultiCurrencySelect)

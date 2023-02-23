import { useState, ChangeEventHandler, useMemo } from 'react'
import { centered, media, spacingIncrement, Switch, Icon } from 'prepo-ui'
import { formatNumber } from 'prepo-utils'
import styled from 'styled-components'
import CurrencyTitleIcon from './CurrencyTitleIcon'
import Modal from '../Modal'
import Input from '../Input'
import { Currency } from '../../types/currency.types'
import { KeyStringMap } from '../../types/common.types'

export type TokenSelectOnChange = (id: string, selected: boolean) => unknown

export type SingleListProp = Currency & {
  selected: boolean
  onChange?: TokenSelectOnChange
  disabled: boolean
}

type Props = {
  currencies: Currency[]
  disabledIds?: KeyStringMap
  onClose?: () => void
  onChange?: TokenSelectOnChange
  open: boolean
  selectedIds?: KeyStringMap
}

const ValueWrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.md};
  padding: 0 ${spacingIncrement(20)};
`

const Divider = styled.div<{ thickness?: number }>`
  border-top: ${({ thickness }): number => thickness || 1}px solid
    ${({ theme }): string => theme.color.primaryAccent};
  height: ${({ thickness }): number => thickness || 1}px;
  left: 0;
  position: absolute;
  width: 100%;
`
const ListWrapper = styled.div`
  padding-top: ${spacingIncrement(5)};
`

const SingleListWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: ${spacingIncrement(15)} 0;
`

const RightWrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin-bottom: ${spacingIncrement(10)};
`

const IconWrapper = styled.div`
  ${centered}
  margin-left: ${spacingIncrement(10)};
`

const StyledInput = styled(Input)`
  && {
    border-radius: ${({ theme }): string => theme.borderRadius.base};
  }
  ::placeholder {
    color: ${({ theme }): string => theme.color.neutral4} !important;
    font-size: ${({ theme }): string => theme.fontSize.sm};
    font-weight: ${({ theme }): number => theme.fontWeight.regular};
    ${media.desktop`
      font-size: ${({ theme }): string => theme.fontSize.base};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
    `}
  }
`

const Description = styled.div`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  padding ${spacingIncrement(14)} 0;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
`

const SingleListDividerWrapper = styled.div`
  :last-child {
    display: none;
  }
`

const SingleList: React.FC<SingleListProp> = ({
  balance,
  disabled,
  id,
  iconName,
  sameUsdValue,
  selected,
  name,
  onChange,
  value,
}) => {
  const description = balance === undefined || sameUsdValue ? undefined : `${balance} ${name}`
  return (
    <>
      <SingleListWrapper>
        <CurrencyTitleIcon iconName={iconName} description={description}>
          {name}
        </CurrencyTitleIcon>
        <RightWrapper>
          <ValueWrapper>{formatNumber(value || 0, { usd: true })}</ValueWrapper>
          <Switch
            onChange={(): unknown => onChange?.(id, !selected)}
            checked={selected}
            disabled={disabled}
          />
        </RightWrapper>
      </SingleListWrapper>
      <SingleListDividerWrapper>
        <Divider />
      </SingleListDividerWrapper>
    </>
  )
}

const TokenSelectionModal: React.FC<Props> = ({
  currencies,
  disabledIds = {},
  onClose,
  onChange,
  open,
  selectedIds = {},
}) => {
  const [searchText, setSerachText] = useState('')

  const handleClose = (): void => {
    if (onClose) onClose()
  }

  const onChangeSearchText: ChangeEventHandler<HTMLInputElement> = (e) => {
    setSerachText(e.target.value)
  }
  const filteredCurrencies = useMemo(
    () =>
      currencies.filter((currency) =>
        currency.name.toLowerCase().includes(searchText.toLowerCase())
      ),
    [currencies, searchText]
  )

  return (
    <Modal
      title="Select Tokens"
      centered
      visible={open}
      onOk={handleClose}
      onCancel={handleClose}
      footer={null}
      titleAlign="left"
    >
      <div>
        <StyledInput
          renderLeft={
            <IconWrapper>
              <Icon name="search" height="20" width="20" color="neutral2" />
            </IconWrapper>
          }
          customStyles={{
            backgroundColor: 'neutral10',
            rounded: true,
          }}
          value={searchText}
          onChange={onChangeSearchText}
          size="middle"
          placeholder="Search name or paste address"
        />
        <Description>
          Selected tokens will be deposited as USD into prePO, and then used towards the current
          trade.
        </Description>
        <Divider thickness={2} />
        <ListWrapper>
          {filteredCurrencies.map((currency) => (
            <SingleList
              key={currency.id}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...currency}
              disabled={Boolean(disabledIds[currency.id])}
              selected={Boolean(selectedIds[currency.id])}
              onChange={onChange}
            />
          ))}
        </ListWrapper>
      </div>
    </Modal>
  )
}

export default TokenSelectionModal

import { toJS } from 'mobx'
import { centered, spacingIncrement, Icon } from 'prepo-ui'
import { useState } from 'react'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import TokenSelectionModal from './TokenSelectionModal'
import CurrencyTitleIcon from './CurrencyTitleIcon'
import useResponsive from '../../hooks/useResponsive'
import { useRootStore } from '../../context/RootStoreProvider'

const SelectionWrapper = styled.div<{ canClick: boolean }>`
  ${centered}
  cursor: ${({ canClick }): string => (canClick ? 'pointer' : 'default')};
  padding: ${spacingIncrement(13)} ${spacingIncrement(12)};
`

const IconWrapper = styled(Icon)`
  ${centered}
`

const IconTitleWrapper = styled(CurrencyTitleIcon)`
  ${centered}
  padding: 0 ${spacingIncrement(35)} 0 ${spacingIncrement(10)};
`

const CurrencySelectionComponent: React.FC = () => {
  const { isDesktop } = useResponsive()
  const { currenciesStore } = useRootStore()
  // we could have just retrieved all these within the modal component
  // but doing it here will give us more flexibility
  // in case we ever need to use the token selection component somewhere else
  // where currencies list is different
  // however, currencies list should be the same for the same user across all feature
  // does not make sense if users have to re-select or re-add
  // their preferred currency everytime they switch feature
  // so it's safe to use currencies at this level instead of passing
  // from feature level (e.g. DepositPage, WithdrawPage)
  const {
    currencies,
    deselectCurrency,
    disabledIds,
    selectedIds,
    selectedCurrencies,
    selectCurrency,
  } = currenciesStore
  const [showModal, setShowModal] = useState(false)
  const iconSize = spacingIncrement(isDesktop ? 30 : 24)

  const handleCloseModal = (): void => {
    setShowModal(false)
  }

  const handleOpenModal = (): void => {
    if (currencies.length <= 1) return
    setShowModal(true)
  }

  const handleChange = (id: string, selected: boolean): void => {
    if (selected) {
      selectCurrency(id)
    } else {
      deselectCurrency(id)
    }
  }

  const currency = selectedCurrencies[0]

  return (
    <>
      <TokenSelectionModal
        currencies={toJS(currencies)}
        disabledIds={toJS(disabledIds)}
        onChange={handleChange}
        onClose={handleCloseModal}
        open={showModal}
        selectedIds={toJS(selectedIds)}
      />
      <SelectionWrapper canClick={currencies.length > 1} onClick={handleOpenModal}>
        {selectedCurrencies.length === 1 && currency ? (
          <IconTitleWrapper iconName={currency.iconName}>{currency.name}</IconTitleWrapper>
        ) : null}
        {currencies.length > 1 && (
          <IconWrapper name="arrow-down" color="neutral2" height={iconSize} width={iconSize} />
        )}
      </SelectionWrapper>
    </>
  )
}
export default observer(CurrencySelectionComponent)

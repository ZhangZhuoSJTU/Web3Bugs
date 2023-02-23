import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { media, spacingIncrement } from 'prepo-ui'
import MarketDropdown from './MarketDropdown'
import DateRangeSelection from './DateRangeSelection'
import MarketTypeSelection from './MarketTypeSelection'
import ActionContainer from './ActionContainer'
import Calendar from './Calendar'
import { useRootStore } from '../../context/RootStoreProvider'
import Modal from '../Modal'

export const LabelWrapper = styled.div`
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: ${spacingIncrement(7)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
`

const FilterModal: React.FC<{ showMarkets?: boolean; filterTypes: string[] }> = ({
  showMarkets = true,
  filterTypes,
}) => {
  const { filterStore } = useRootStore()
  const { isFilterOpen, isCalendarOpen } = filterStore
  const onClose = (): void => {
    if (isCalendarOpen) {
      filterStore.setIsCalendarOpen(false)
    } else {
      filterStore.resetFilters()
      filterStore.setIsFilterOpen(false)
    }
  }

  let title = 'Filter'
  let titleAlign: 'left' | 'center' = 'left'

  if (isCalendarOpen) {
    title = 'Select Start and End Date'
    titleAlign = 'center'
  }
  return (
    <Modal
      title={title}
      centered
      visible={isFilterOpen}
      onOk={onClose}
      onCancel={onClose}
      footer={null}
      titleAlign={titleAlign}
    >
      {isCalendarOpen ? (
        <Calendar />
      ) : (
        <>
          {showMarkets && <MarketDropdown />}
          <DateRangeSelection />
          <MarketTypeSelection filterTypes={filterTypes} />
          <ActionContainer />
        </>
      )}
    </Modal>
  )
}

export default observer(FilterModal)

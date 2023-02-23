import { spacingIncrement, Button } from 'prepo-ui'
import { observer } from 'mobx-react-lite'
import styled from 'styled-components'
import { useRootStore } from '../../context/RootStoreProvider'

const Wrapper = styled.div`
  display: grid;
  grid-gap: 0 ${spacingIncrement(16)};
  grid-template-columns: auto auto;
  padding: ${spacingIncrement(35)} 0 0 0;
`

const ActionContainer: React.FC = () => {
  const { filterStore } = useRootStore()
  const { isCalendarOpen, filterOptions } = filterStore
  let leftButtonText = 'Reset'
  if (isCalendarOpen) {
    leftButtonText = 'Cancel'
  }

  const onCancel = (): void => {
    if (isCalendarOpen) {
      filterStore.useConfirmedDateRange()
      filterStore.setIsCalendarOpen(false)
    } else {
      filterStore.resetFilters()
    }
  }
  const onConfirm = (): void => {
    if (isCalendarOpen) {
      // keep track of previously selected date range
      filterStore.confirmDateRange()
      filterStore.setIsCalendarOpen(false)
    } else {
      filterStore.confirmChanges()
      filterStore.setIsFilterOpen(false)
    }
  }

  const calendarNotComplete =
    isCalendarOpen && (!filterOptions.dateRange.end || !filterOptions.dateRange.start)

  return (
    <Wrapper>
      <Button block type="ghost" onClick={onCancel}>
        {leftButtonText}
      </Button>
      <Button block type="primary" onClick={onConfirm} disabled={calendarNotComplete}>
        Confirm
      </Button>
    </Wrapper>
  )
}

export default observer(ActionContainer)

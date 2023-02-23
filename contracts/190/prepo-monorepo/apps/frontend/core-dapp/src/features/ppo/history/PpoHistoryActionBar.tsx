import { Button, Flex } from 'prepo-ui'
import styled from 'styled-components'
import { observer } from 'mobx-react-lite'
import { CSVLink } from 'react-csv'
import { useEffect } from 'react'
import { Trans } from '@lingui/macro'
import { ppoHistoryFilterTypes } from './ppo-history.types'
import { useRootStore } from '../../../context/RootStoreProvider'
import FilterModal from '../../../components/Filter'

const StyledButton = styled(Button)<{ disabled?: boolean }>`
  &&&& {
    .ant-btn {
      background-color: transparent;
      color: ${({ theme }): string => theme.color.neutral2};
      border-color: ${({ theme }): string => theme.color.neutral7};
      min-width: 158px;
      width: 100%;
    }
    .ant-btn:hover {
      border-color: ${({ disabled, theme }): string =>
        disabled ? theme.color.neutral7 : theme.color.primary};
    }
  }
`

const PpoHistoryActionBar: React.FC = () => {
  const {
    ppoHistoryStore: { dataForExport },
    filterStore: { setSelectedFilterTypes, setIsFilterOpen },
  } = useRootStore()

  useEffect(() => {
    setSelectedFilterTypes(undefined)
  }, [setSelectedFilterTypes])

  return (
    <Flex gap={{ phone: 20, desktop: 32 }} justifyContent="flex-end" my={30}>
      <FilterModal filterTypes={ppoHistoryFilterTypes} showMarkets={false} />
      <StyledButton disabled={dataForExport.length === 0}>
        <CSVLink data={dataForExport} filename="ppo_history_data">
          <Trans>Export CSV</Trans>
        </CSVLink>
      </StyledButton>

      <StyledButton onClick={(): void => setIsFilterOpen(true)}>
        <Trans>Filter</Trans>
      </StyledButton>
    </Flex>
  )
}

export default observer(PpoHistoryActionBar)

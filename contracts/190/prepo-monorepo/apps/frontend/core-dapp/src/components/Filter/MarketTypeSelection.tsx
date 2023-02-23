import { observer } from 'mobx-react-lite'
import { centered, media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { LabelWrapper } from './FilterModal'
import { useRootStore } from '../../context/RootStoreProvider'

const MainWrapper = styled.div`
  margin-top: ${spacingIncrement(24)};
`

const FilterItemsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${spacingIncrement(10)};
`

const SingleFilterItem = styled.div<{ selected?: boolean }>`
  ${centered}
  background-color: ${({ theme, selected }): string =>
    selected ? theme.color.neutral7 : theme.color.neutral9};
  border: 1px solid ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  color: ${({ theme }): string => theme.color.neutral1};
  cursor: pointer;
  font-size: ${({ theme }): string => theme.fontSize.xs};
  height: ${spacingIncrement(31)};
  padding: 0 ${spacingIncrement(14)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.sm};
    height: ${spacingIncrement(35)};
  `}
`

const ALL = 'All'

const MarketTypeSelection: React.FC<{ filterTypes: string[] }> = ({ filterTypes }) => {
  const { filterStore } = useRootStore()
  const {
    filterOptions: { selectedFilterTypes },
  } = filterStore

  const onClick = (type: string): void => {
    if (type === ALL) {
      filterStore.setSelectedFilterTypes(undefined)
      return
    }

    const newTypes = selectedFilterTypes ?? []
    if (newTypes.includes(type)) {
      newTypes.splice(newTypes.indexOf(type), 1)
    } else {
      newTypes.push(type)
    }

    // if deselect everything or select everything, it should select All by default which sets the value to undefined
    filterStore.setSelectedFilterTypes(
      newTypes.length === 0 || newTypes.length === filterTypes.length ? undefined : [...newTypes]
    )
  }

  return (
    <MainWrapper>
      <LabelWrapper>Type</LabelWrapper>
      <FilterItemsWrapper>
        {[ALL, ...filterTypes].map((type) => (
          <SingleFilterItem
            key={type}
            selected={selectedFilterTypes ? selectedFilterTypes.includes(type) : type === ALL}
            onClick={(): void => onClick(type)}
          >
            {type}
          </SingleFilterItem>
        ))}
      </FilterItemsWrapper>
    </MainWrapper>
  )
}

export default observer(MarketTypeSelection)

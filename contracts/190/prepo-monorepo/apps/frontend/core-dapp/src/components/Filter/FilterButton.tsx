import { centered, Icon, media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import FilterModal from './FilterModal'
import { portfolioHistoryFilterTypes } from './filter.constants'
import useResponsive from '../../hooks/useResponsive'
import { useRootStore } from '../../context/RootStoreProvider'

const ButtonWrapper = styled.div`
  align-items: center;
  color: ${({ theme }): string => theme.color.neutral5};
  cursor: pointer;
  display: flex;
  transition: 0.3s;
  svg {
    height: ${spacingIncrement(5)};
    width: ${spacingIncrement(9)};
  }
  ${media.desktop`
      svg {
        height: ${spacingIncrement(7)};
        width: ${spacingIncrement(13)};
      }
  `};
  :hover {
    opacity: 0.7;
  }
`

const IconWrapper = styled(Icon)`
  ${centered}
`

const ButtonText = styled.p`
  color: ${({ theme }): string => theme.color.neutral3};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  margin-bottom: 0;
  margin-right: ${spacingIncrement(10)};
  opacity: 0.84;
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.md};
    margin-right: ${spacingIncrement(14)};
  `}
`

const FilterButton: React.FC = () => {
  const { isDesktop } = useResponsive()
  const {
    filterStore: { setSelectedFilterTypes, setIsFilterOpen },
  } = useRootStore()
  useEffect(() => {
    setSelectedFilterTypes(undefined)
  }, [setSelectedFilterTypes])

  let height = '16'
  let width = '16'
  if (isDesktop) {
    height = '20'
    width = '20'
  }
  return (
    <>
      <FilterModal filterTypes={portfolioHistoryFilterTypes} />
      <ButtonWrapper onClick={(): void => setIsFilterOpen(true)}>
        <ButtonText>Filter</ButtonText>
        <IconWrapper name="sort-down" color="neutral2" height={height} width={width} />
      </ButtonWrapper>
    </>
  )
}

export default observer(FilterButton)

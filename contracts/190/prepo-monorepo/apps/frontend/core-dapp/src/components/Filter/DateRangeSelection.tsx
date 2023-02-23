import { observer } from 'mobx-react-lite'
import { centered, Icon, media, spacingIncrement } from 'prepo-ui'
import styled from 'styled-components'
import { format } from 'date-fns'
import { LabelWrapper } from './FilterModal'
import { useRootStore } from '../../context/RootStoreProvider'
import useResponsive from '../../hooks/useResponsive'

const MainWrapper = styled.div`
  margin-top: ${spacingIncrement(24)};
`

const SelectionWrapper = styled.span`
  align-items: center;
  background-color: ${({ theme }): string => theme.color.marketChartFloatingCard};
  border: 1px solid ${({ theme }): string => theme.color.neutral8};
  border-radius: ${({ theme }): string => theme.borderRadius.md};
  color: ${({ theme }): string => theme.color.neutral1};
  cursor: pointer;
  display: flex;
  flex-direction: row;
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  gap: ${spacingIncrement(10)};
  height: ${spacingIncrement(40)};
  line-height: 1;
  padding: 0 ${spacingIncrement(15)};
  ${media.desktop`
    font-size: ${({ theme }): string => theme.fontSize.sm};
  `}
`

const IconWrapper = styled(Icon)`
  ${centered}
`

const DateRangeSelection: React.FC = () => {
  const { filterStore } = useRootStore()
  const { filterOptions } = filterStore
  const onClick = (): void => {
    filterStore.setIsCalendarOpen(true)
  }
  const { isDesktop } = useResponsive()
  let height = '16'
  let width = '16'
  if (isDesktop) {
    height = '20'
    width = '20'
  }
  return (
    <MainWrapper>
      <LabelWrapper>Dates</LabelWrapper>
      <SelectionWrapper onClick={onClick}>
        <IconWrapper name="calendar" height={height} width={width} />
        {filterOptions.dateRange.start
          ? format(filterOptions.dateRange.start, 'dd MMM yyyy')
          : ''}{' '}
        - {filterOptions.dateRange.end ? format(filterOptions.dateRange.end, 'dd MMM yyyy') : ''}
      </SelectionWrapper>
    </MainWrapper>
  )
}

export default observer(DateRangeSelection)

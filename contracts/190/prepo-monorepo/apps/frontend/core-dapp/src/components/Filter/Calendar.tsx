import { observer } from 'mobx-react-lite'
import { centered, Icon, media, spacingIncrement } from 'prepo-ui'
import { format } from 'date-fns'
import RCalendar, { CalendarTileProperties, OnChangeDateRangeCallback } from 'react-calendar'
import styled from 'styled-components'
import ActionContainer from './ActionContainer'
import { useRootStore } from '../../context/RootStoreProvider'

const MainWrapper = styled.div`
  ${centered}
`

const CalendarWrapper = styled.div`
  width: ${spacingIncrement(400)};
  &&& {
    .react-calendar {
      background: ${({ theme }): string => theme.color.neutral9};
      color: ${({ theme }): string => theme.color.neutral1};
    }
    .react-calendar button {
      margin: 0;
      border: 0;
      outline: none;
    }
    .react-calendar button:enabled:hover {
      cursor: pointer;
    }
    .react-calendar__navigation {
      display: flex;
      height: ${spacingIncrement(35)};
      margin-bottom: ${spacingIncrement(30)};
    }
    .react-calendar__navigation__arrow.react-calendar__navigation__next2-button,
    .react-calendar__navigation__arrow.react-calendar__navigation__prev2-button {
      display: none;
    }
    .react-calendar__navigation button {
      background: none;
      min-width: ${spacingIncrement(44)};
    }
    .react-calendar__month-view__weekdays {
      text-align: center;
      text-transform: uppercase;
      font-weight: bold;
      font-size: ${({ theme }): string => theme.fontSize.xs};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.sm};
      `}
      margin-bottom: ${spacingIncrement(10)};
    }
    .react-calendar__month-view__weekdays__weekday {
      ${centered};
      color: ${({ theme }): string => theme.color.neutral2};
      font-size: ${({ theme }): string => theme.fontSize.xs};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.sm};
      `}
      abbr {
        text-decoration: none;
        cursor: default;
      }
    }
    .react-calendar__month-view__days {
      ${centered};
      gap: ${spacingIncrement(10)};
    }
    .react-calendar__month-view__days__day--weekend {
      background-color: unset;
    }
    .react-calendar__month-view__days__day--neighboringMonth {
      color: #bdbdbd;
    }
    .react-calendar__navigation__label {
      font-size: ${({ theme }): string => theme.fontSize.xs};
      ${media.desktop`
        font-size: ${({ theme }): string => theme.fontSize.sm};
      `}
      font-weight: ${({ theme }): number => theme.fontWeight.semiBold};
      :hover {
        color: ${({ theme }): string => theme.color.secondary};
      }
    }
    display: grid;
    .react-calendar__year-view .react-calendar__tile,
    .react-calendar__decade-view .react-calendar__tile,
    .react-calendar__century-view .react-calendar__tile {
      padding: ${spacingIncrement(30)} ${spacingIncrement(4)};
    }
    .react-calendar__tile.react-calendar__month-view__days__day {
      max-width: unset !important;
      flex-basis: 10.4% !important;
      ${media.phone`
        flex-basis: 11.4% !important;
      `}
      ${media.tablet`
        flex-basis: 12% !important;
      `}
    }
    .react-calendar__tile {
      ${centered};
      height: ${spacingIncrement(27)};
      border-radius: ${({ theme }): string => theme.borderRadius.xs};
      text-align: center;
      background: none;
      padding: ${spacingIncrement(5)} ${spacingIncrement(10)};
      font-size: ${({ theme }): string => theme.fontSize.sm};
      font-weight: ${({ theme }): number => theme.fontWeight.medium};
    }
    .react-calendar__tile--hasActive:enabled:hover,
    .react-calendar__tile--hasActive:enabled:focus {
      background: ${({ theme }): string => theme.color.accent2};
    }
    .react-calendar__tile--active {
      background: ${({ theme }): string => theme.color.accent2};
      color: ${({ theme }): string => theme.color.primary};
    }
    .react-calendar__tile:enabled:hover,
    .react-calendar__tile:enabled:focus,
    .react-calendar__tile--active:enabled:hover,
    .react-calendar__tile--active:enabled:focus,
    .react-calendar__tile--hasActive,
    .selected-dates {
      background: ${({ theme }): string => theme.color.primary};
      color: ${({ theme }): string => theme.color.white};
    }
    .react-calendar--selectRange .react-calendar__tile--hover {
      background: ${({ theme }): string => theme.color.accent1};
      color: ${({ theme }): string => theme.color.primary};
    }
  }
`

const DateRangeWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: ${spacingIncrement(12)};
`

const DateTextContainer = styled.div<{ active?: boolean }>`
  ${centered};
  border: 1px solid
    ${({ theme, active }): string => (active ? theme.color.primary : theme.color.neutral7)};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  color: ${({ theme }): string => theme.color.neutral1};
  font-size: ${({ theme }): string => theme.fontSize.xs};
  font-size: ${({ theme }): string => theme.fontSize.sm};
  font-weight: ${({ theme }): number => theme.fontWeight.medium};
  height: ${spacingIncrement(45)};
  width: ${spacingIncrement(140)};
`

const NavWrapper = styled.div`
  ${centered};
  border: 1px solid ${({ theme }): string => theme.color.neutral7};
  border-radius: ${({ theme }): string => theme.borderRadius.xs};
  height: ${spacingIncrement(32)};
  width: ${spacingIncrement(32)};
`

const compareDates = (date1?: Date, date2?: Date): boolean =>
  date1?.getFullYear() === date2?.getFullYear() &&
  date1?.getMonth() === date2?.getMonth() &&
  date1?.getDate() === date2?.getDate()

const tileContent = (start?: Date, end?: Date, date?: Date): string => {
  if (compareDates(start, date) || compareDates(end, date)) {
    return 'selected-dates'
  }
  return ''
}

const IconWrapper = styled(Icon)`
  ${centered}
`

const Calendar: React.FC<{ className?: string }> = ({ className }) => {
  const { filterStore } = useRootStore()
  const {
    dateRange: { start: startDate, end: endDate },
  } = filterStore.filterOptions
  const onChange: OnChangeDateRangeCallback = (dates): void => {
    const [start, end] = dates
    filterStore.setDateRange({ start, end })
  }
  const defaultValue = (): Date[] => {
    const value: Date[] = []
    if (startDate) value.push(startDate)
    if (endDate) value.push(endDate)
    return value
  }

  return (
    <MainWrapper className={className}>
      <CalendarWrapper>
        <DateRangeWrapper>
          <DateTextContainer active={!startDate}>
            {startDate && format(startDate, 'd-MMM-yyyy')}
          </DateTextContainer>
          <IconWrapper name="arrow-right-3" color="neutral2" height="20" width="20" />
          <DateTextContainer active={!endDate}>
            {endDate && format(endDate, 'd-MMM-yyyy')}
          </DateTextContainer>
        </DateRangeWrapper>
        <RCalendar
          defaultValue={defaultValue()}
          selectRange
          formatShortWeekday={(local, date): string => format(date, 'ccccc')}
          nextLabel={
            <NavWrapper>
              <IconWrapper name="arrow-right-2" color="neutral2" height="23" width="23" />
            </NavWrapper>
          }
          prevLabel={
            <NavWrapper>
              <IconWrapper name="arrow-left" color="neutral2" height="23" width="23" />
            </NavWrapper>
          }
          onChange={onChange}
          tileClassName={({ date }: CalendarTileProperties): string =>
            tileContent(startDate, endDate, date)
          }
          allowPartialRange
        />
        <ActionContainer />
      </CalendarWrapper>
    </MainWrapper>
  )
}

export default observer(Calendar)

import { MIN_IN_MS, SEC_IN_MS } from 'prepo-constants'
import endOfHour from 'date-fns/endOfHour'
import endOfDay from 'date-fns/endOfDay'
import format from 'date-fns/format'
import startOfDay from 'date-fns/startOfDay'
import startOfHour from 'date-fns/startOfHour'
import { DateRange } from '../types/general.types'

const DATE_FORMAT = 'do LLLL yyyy' // 1st January 2025
const DATE_FORMAT_SHORTEN_MONTH = 'do LLL yyyy' // 1st Jan 2025
const TIME_FORMAT_12 = 'h:mma'
const TIME_FORMAT_24 = 'h:MM'

export const getEndOfDay = (ms: number): number => endOfDay(ms).getTime()
export const getStartOfDay = (ms: number): number => startOfDay(ms).getTime()
export const getStartOfHour = (ms: number): number => startOfHour(ms).getTime()
export const getDateAndLiteralMonthFromMs = (ms: number): string => format(ms, 'dd MMM')
export const getHourMinsFromMs = (ms: number): string => format(ms, 'HH:mm')
export const getEndOfHour = (ms: number): number => endOfHour(ms).getTime()

export const getUTCEndOfDay = (ms: number): number => {
  const localEndOfDay = getEndOfDay(ms)
  const offsetMins = new Date(localEndOfDay).getTimezoneOffset()
  return localEndOfDay - offsetMins * MIN_IN_MS
}

export const getUTCStartOfDay = (ms: number): number => {
  const localStartOfDay = getStartOfDay(ms)
  const offsetMins = new Date(localStartOfDay).getTimezoneOffset()
  return localStartOfDay - offsetMins * MIN_IN_MS
}

export const getFullDateFromMs = (ms: number | string): string => {
  try {
    return format(new Date(ms), DATE_FORMAT)
  } catch (error) {
    return 'Invalid Date'
  }
}

export const getFullDateShortenMonthFromMs = (ms: number | string): string => {
  try {
    return format(new Date(ms), DATE_FORMAT_SHORTEN_MONTH)
  } catch (error) {
    return 'Invalid Date'
  }
}

export const getFullDateTimeFromSeconds = (seconds: number): string => {
  try {
    return format(seconds * SEC_IN_MS, `yyyy-MM-dd HH:mm:ss`)
  } catch (error) {
    return 'Invalid Date Time'
  }
}

export const getFullLiteralDateTimeFromSeconds = (seconds: number): string => {
  try {
    return format(seconds * SEC_IN_MS, `MMM do, yyyy, ${TIME_FORMAT_24}`)
  } catch (error) {
    return 'Invalid Date Time'
  }
}

export const getFullStringFromMs = (ms: number | string): string => {
  try {
    return format(new Date(ms), `${DATE_FORMAT}, ${TIME_FORMAT_12}`)
  } catch (error) {
    return 'Invalid Date Time'
  }
}

export const get24TimeFromSeconds = (seconds: number): string => {
  try {
    return format(seconds * SEC_IN_MS, TIME_FORMAT_24)
  } catch (error) {
    return 'Invalid Time'
  }
}

export const getHoursByMiliseconds = (miliseconds: number): number =>
  Math.floor(miliseconds / 1000 / 60 / 60)

export const getMilisecondsByHours = (hours: number): number => hours * 60 * 60 * 1000

export const getDateRangeFromHours = (hours: number, fromMiliseconds?: number): DateRange => {
  const endTimeInMs = fromMiliseconds ?? new Date().getTime()
  const startTimeInMs = endTimeInMs - getMilisecondsByHours(hours)
  return { endTimeInMs, startTimeInMs }
}

export const getDateRangeFromDays = (days: number, fromMiliseconds?: number): DateRange => {
  const endTimeInMs = fromMiliseconds ?? new Date().getTime()
  const startTimeInMs = endTimeInMs - getMilisecondsByHours(days * 24)
  return { endTimeInMs, startTimeInMs }
}

export const getHoursFromDateRange = ({ endTimeInMs, startTimeInMs }: DateRange): number =>
  getHoursByMiliseconds(endTimeInMs - startTimeInMs)

export const getDaysFromDateRange = (dateRange: DateRange): number =>
  Math.ceil(getHoursFromDateRange(dateRange) / 24)

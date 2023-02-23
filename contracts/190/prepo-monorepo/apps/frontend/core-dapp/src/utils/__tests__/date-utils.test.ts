import { getFullDateFromMs, getFullStringFromMs } from '../date-utils'

const validUTCMorningTimestamp = [
  1635143228000,
  '2021-10-25T06:27:53+00:00',
  'Mon, 25 Oct 2021 06:27:53 GMT',
  '2021-10-25T06:27:53Z',
]
const validUTCNightTimestamp = [
  1633198815000,
  '2021-10-02T18:20:15+00:00',
  'Sat, 2 Oct 2021 18:20:15 GMT',
  '2021-10-02T18:20:15Z',
]
const invalidTimestamp = '2021-11-20 | 12:20:20PM'
const expectedValidUTCMorning = '25th October 2021, 6:27AM'
const expectedValidUTCNight = '2nd October 2021, 6:20PM'

describe('getFullDateFromMs tests', () => {
  it('should return date string given valid timestamp', () => {
    for (let i = 0; i < validUTCMorningTimestamp.length; i++) {
      const date = getFullDateFromMs(validUTCMorningTimestamp[i])
      expect(date).toBe(expectedValidUTCMorning.split(',')[0])
    }
  })

  it('should return undefined given invalid timestamp', () => {
    const date = getFullDateFromMs(invalidTimestamp)
    expect(date).toBe('Invalid Date')
  })
})

describe('getFullStringFromMs tests', () => {
  it('should return time string given valid timestamp', () => {
    for (let i = 0; i < validUTCMorningTimestamp.length; i++) {
      const date = getFullStringFromMs(validUTCMorningTimestamp[i])
      expect(date).toBe(expectedValidUTCMorning)
    }
  })

  it('should return time string in PM given valid night timestamp', () => {
    for (let i = 0; i < validUTCNightTimestamp.length; i++) {
      const date = getFullStringFromMs(validUTCNightTimestamp[i])
      expect(date).toBe(expectedValidUTCNight)
    }
  })

  it('should return undefined given invalid timestamp', () => {
    const date = getFullStringFromMs(invalidTimestamp)
    expect(date).toBe('Invalid Date Time')
  })
})

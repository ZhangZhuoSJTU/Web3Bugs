/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react-hooks'
// eslint-disable-next-line jest/no-mocks-import
import { mockedFormattedMarketData } from '../../__mocks__/test-mocks/market-utils.mocks'
import useTransformedTVLData from '../useTransformedTVLData'

const expectedResult = [
  { time: 1646092800, value: 1000 }, // 1 March 2022 00:00:00 UTC TIME
  { time: 1646179200, value: 1500 }, // 2 March 2022 00:00:00 UTC TIME
  { time: 1646265600, value: 1200 }, // 3 March 2022 00:00:00 UTC TIME
  { time: 1646352000, value: 1300 }, // 4 March 2022 00:00:00 UTC TIME
  { time: 1646438400, value: 1400 }, // 5 March 2022 00:00:00 UTC TIME
]

describe('useTransformedTVLData', () => {
  it('should return data correctly', () => {
    const { result } = renderHook(() => useTransformedTVLData(mockedFormattedMarketData))
    expect(result.current).toStrictEqual(expectedResult)
  })
})

// eslint-disable-next-line jest/no-mocks-import
import {
  mockFormatPoolsDayDatasOptions,
  mockMarketDatas,
  mockNormalizedPoolsDayDatas,
  mockPayoutRange,
  mockPoolsDayDatas,
  mockValuationRange,
} from '../../__mocks__/test-mocks/market-utils.mocks'
import {
  calculateValuation,
  formatMarketHistoricalData,
  normalizePoolsDayDatas,
} from '../market-utils'

describe('calculateValuation tests', () => {
  it('should return corrent value', () => {
    mockMarketDatas.forEach(({ longTokenPrice, valuation }) => {
      expect(
        calculateValuation({
          longTokenPrice,
          payoutRange: mockPayoutRange,
          valuationRange: mockValuationRange,
        })
      ).toBe(valuation)
    })
  })
})

describe('normalizePoolsDayDatas tests', () => {
  it('should return correct data', () => {
    const output = normalizePoolsDayDatas(mockPoolsDayDatas)
    expect(output).toStrictEqual(mockNormalizedPoolsDayDatas)
  })
})

describe('formatPoolsDayDatas tests', () => {
  // testing strategy:
  // goals if this test is to test 4 things
  // 1. out of range data will not be included
  // 2. when first data is not available within in range data, backfill with latest outrange data
  // 3. it should backfill all data correctly such that if a user queries 100 days
  // even if there's only 80 data, it should still give us 100 days of data
  // 4. valuation will only ever use long token's price

  const now = new Date()
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date(1640908800000).getTime()) // 31 December 2021 00:00:00
  })

  afterAll(() => {
    jest.useFakeTimers().setSystemTime(now)
  })

  // set the startTimestamp to 24 December
  // give data on 23, but not on 24
  // make sure it backfills 24 with 23's data
  // but does not show 23 on the list
  it(`should only allow in-range data and will backfill data`, () => {
    const formattedData = formatMarketHistoricalData(
      mockNormalizedPoolsDayDatas,
      mockFormatPoolsDayDatasOptions
    )
    expect(formattedData).toStrictEqual([
      { liquidity: 200, timestamp: 1640304000, valuation: 30000, volume: 0 }, // 24 December 2021 00:00:00 UTC
      { liquidity: 200, timestamp: 1640390400, valuation: 30000, volume: 150 }, // 25 December 2021 00:00:00 UTC
      { liquidity: 200, timestamp: 1640476800, valuation: 50000, volume: 150 }, // 26 December 2021 00:00:00 UTC
      { liquidity: 300, timestamp: 1640563200, valuation: 36666.67, volume: 200 }, // 27 December 2021 00:00:00 UTC
      { liquidity: 400, timestamp: 1640649600, valuation: 36666.67, volume: 200 }, // 28 December 2021 00:00:00 UTC
      { liquidity: 400, timestamp: 1640736000, valuation: 43333.33, volume: 400 }, // 29 December 2021 00:00:00 UTC
      { liquidity: 400, timestamp: 1640822400, valuation: 43333.33, volume: 0 }, // 30 December 2021 00:00:00 UTC
      { liquidity: 400, timestamp: 1640908800, valuation: 43333.33, volume: 0 }, // 31 December 2021 00:00:00 UTC
    ])
  })
})

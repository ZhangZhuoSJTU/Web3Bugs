import Market from '../market'
import Actor from '../actor'
import { DELTA, EMPTY_MARKET_BALANCE } from '../../constants'
import Pool from '../pool'

const config = {
  bounds: { ceil: 0.8, floor: 0.2 },
  fee: 0.02,
  protocolFee: 0.01,
}
const initialDeposit = 1000
const marketName = 'test-market'
let market: Market
let creator: Actor

describe('a market is created', () => {
  beforeEach(() => {
    creator = new Actor('creator', initialDeposit)
    market = new Market(marketName, config, initialDeposit, creator)
  })

  test('the name is set correctly', () => {
    expect(market.name).toEqual(marketName)
  })

  test('the config is set correctly', () => {
    expect(market.config).toEqual(config)
  })

  test('long pool is initialized with correct balances', () => {
    expect(market.longPool.realReserves).toMatchSnapshot()
  })

  test('short pool is initialized with correct balances', () => {
    expect(market.shortPool.realReserves).toMatchSnapshot()
  })

  test('convertedStableDeposit is initialized correctly', () => {
    expect(market.convertedStableTokens).toMatchSnapshot()
  })

  test('creator has no leftover balance', () => {
    expect(market.getActorBalance(creator)).toEqual(EMPTY_MARKET_BALANCE)
  })

  test('creator usd balance is decremented correctly', () => {
    expect(creator.getUsdBalance()).toEqual(0)
  })

  test('actorStableIn is set correctly', () => {
    expect(market.getActorStableIn(creator)).toEqual(initialDeposit)
  })

  test('creator net worth set correctly', () => {
    const creatorNetWorth = market.getActorNetWorth(creator)
    expect(creatorNetWorth).toMatchSnapshot()
  })

  describe('a second LP deposits', () => {
    let secondLp: Actor
    const secondLpSize = 500
    beforeEach(() => {
      secondLp = new Actor('second-lp', secondLpSize)
      market.deposit(secondLp, secondLpSize)
    })

    test('convertedStableDeposit is updated correctly', () => {
      expect(market.convertedStableTokens).toMatchSnapshot()
    })

    test('secondLp has no leftover balance', () => {
      expect(market.getActorBalance(secondLp)).toEqual(EMPTY_MARKET_BALANCE)
    })

    test('secondLp usd balance is decremented correctly', () => {
      expect(secondLp.getUsdBalance()).toEqual(0)
    })

    test('actorStableIn is set correctly', () => {
      expect(market.getActorStableIn(secondLp)).toEqual(secondLpSize)
    })

    describe('a trader opens a long position', () => {
      let trader: Actor
      const initialPositionSize = 100
      beforeEach(() => {
        trader = new Actor('trader', initialPositionSize)
        market.openPosition(trader, 'long', initialPositionSize)
      })

      test('trader stable balance is updated correctly', () => {
        expect(trader.getUsdBalance()).toEqual(0)
      })

      test('trader long balance is updated correctly', () => {
        expect(market.getActorBalance(trader)).toMatchSnapshot()
      })

      test('trader net worth is set correctly', () => {
        const traderNetWorth = market.getActorNetWorth(trader)
        // slightly lower than their trade size due to arbitrager pushing price down
        expect(traderNetWorth).toMatchSnapshot()
      })

      test('trader net profit is set correctly', () => {
        const traderNetProfit = market.getActorNetProfit(trader)
        expect(traderNetProfit).toMatchSnapshot()
      })

      test('trader stable deposit is recorded correctly', () => {
        expect(market.getActorStableIn(trader)).toEqual(initialPositionSize)
      })

      test('the pools have been kept balanced by arbitragers', () => {
        const longPrice = Pool.calcMarketTokenPrice(market.longPool)
        const shortPrice = Pool.calcMarketTokenPrice(market.shortPool)
        const result = Math.abs(longPrice - shortPrice) < DELTA
        expect(result).toBe(false)
      })

      describe('the trader closes half their position', () => {
        beforeEach(() => {
          market.closePosition(trader, 'long', market.getActorBalance(trader).long / 2)
        })

        test('trader stable balance is updated correctly', () => {
          expect(trader.getUsdBalance()).toMatchSnapshot()
        })

        test('trader long balance is updated correctly', () => {
          expect(market.getActorBalance(trader)).toMatchSnapshot()
        })

        test('trader stable withdrawal is recorded correctly', () => {
          expect(market.getActorStableOut(trader)).toMatchSnapshot()
        })

        test('trader net worth is updated correctly', () => {
          const traderNetWorth = market.getActorNetWorth(trader)
          expect(traderNetWorth).toMatchSnapshot()
        })

        test('trader net profit is updated correctly', () => {
          const traderNetProfit = market.getActorNetProfit(trader)
          expect(traderNetProfit).toMatchSnapshot()
        })

        test('trader amountOut set correctly', () => {
          const amountOut = market.getActorStableOut(trader)
          expect(amountOut).toMatchSnapshot()
        })

        test('the pools have been kept balanced by arbitragers', () => {
          const longPrice = Pool.calcMarketTokenPrice(market.longPool)
          const shortPrice = Pool.calcMarketTokenPrice(market.shortPool)
          const result = Math.abs(longPrice - shortPrice) < DELTA
          expect(result).toBe(false)
        })
      })
    })

    describe('a trader opens a short position', () => {
      let trader: Actor
      const initialPositionSize = 300
      beforeEach(() => {
        trader = new Actor('trader', initialPositionSize)
        market.openPosition(trader, 'short', initialPositionSize)
      })

      test('trader stable balance is updated correctly', () => {
        expect(trader.getUsdBalance()).toEqual(0)
      })

      test('trader long balance is updated correctly', () => {
        expect(market.getActorBalance(trader)).toMatchSnapshot()
      })

      test('trader net worth is set correctly', () => {
        const traderNetWorth = market.getActorNetWorth(trader)
        // slightly lower than their trade size due to arbitrager pushing price down
        expect(traderNetWorth).toMatchSnapshot()
      })

      test('trader net profit is set correctly', () => {
        const traderNetProfit = market.getActorNetProfit(trader)
        expect(traderNetProfit).toMatchSnapshot()
      })

      test('trader stable deposit is recorded correctly', () => {
        expect(market.getActorStableIn(trader)).toEqual(initialPositionSize)
      })

      test('the pools have been kept balanced by arbitragers', () => {
        const longPrice = Pool.calcMarketTokenPrice(market.longPool)
        const shortPrice = Pool.calcMarketTokenPrice(market.shortPool)
        const result = Math.abs(longPrice - shortPrice) < DELTA
        expect(result).toBe(false)
      })

      describe('a third LP makes a deposit at bottom of range', () => {
        let thirdLp: Actor
        const positionSize = 200
        beforeEach(() => {
          thirdLp = new Actor('third-lp', positionSize)
          market.deposit(thirdLp, positionSize)
        })

        test('third LP should have 0 market token balances', () => {
          const bal = market.getActorBalance(thirdLp)
          const balanceLong = Math.abs(bal.long) < DELTA
          const balanceShort = Math.abs(bal.short) < DELTA
          expect(balanceLong).toBe(true)
          expect(balanceShort).toBe(true)
        })

        test('third LP net worth should be calculated correctly', () => {
          expect(market.getActorNetWorth(thirdLp)).toMatchSnapshot()
        })

        describe('trader trades price to top of the range', () => {
          beforeEach(() => {
            market.tradeToTargetPrice(trader, config.bounds.ceil)
          })

          test('third LP net worth should be calculated correctly', () => {
            expect(market.getActorNetWorth(thirdLp)).toMatchSnapshot()
          })
        })
      })
    })
  })
})

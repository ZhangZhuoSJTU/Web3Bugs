/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { configure } from 'mobx'
import { markets } from '../../../lib/markets'
import { Erc20Store } from '../../../stores/entities/Erc20.entity'
import { MarketEntity } from '../../../stores/entities/MarketEntity'
// eslint-disable-next-line jest/no-mocks-import
import { poolMock } from '../../../__mocks__/test-mocks/pool.mock'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const selectedMarket = new MarketEntity(rootStore, markets[0])
const amountToTrade = '100'
const PRECT_BALANCE = '2000'
const PRECT_DECIMALS = 18

beforeAll(() => {
  selectedMarket.fetchPools()
})

describe('TradeStore tests', () => {
  let spyPreCTTokenBalance: jest.SpyInstance
  let spyPreCTDecimalsNumber: jest.SpyInstance
  let spyPreCTTokenBalanceRaw: jest.SpyInstance
  beforeAll(() => {
    spyPreCTTokenBalance = jest
      .spyOn(rootStore.preCTTokenStore, 'tokenBalanceFormat', 'get')
      .mockReturnValue(PRECT_BALANCE)

    spyPreCTDecimalsNumber = jest
      .spyOn(rootStore.preCTTokenStore, 'decimalsNumber', 'get')
      .mockReturnValue(PRECT_DECIMALS)

    const PRECT_BALANCE_BIGNUMBER = rootStore.preCTTokenStore.parseUnits(
      `${PRECT_BALANCE}`
    ) as BigNumber

    spyPreCTTokenBalanceRaw = jest
      .spyOn(rootStore.preCTTokenStore, 'tokenBalanceRaw', 'get')
      .mockReturnValue(PRECT_BALANCE_BIGNUMBER)
  })

  afterAll(() => {
    spyPreCTTokenBalance.mockRestore()
    spyPreCTTokenBalanceRaw.mockRestore()
    spyPreCTDecimalsNumber.mockRestore()
  })

  it('should initialize trade with long direction as default', () => {
    expect(rootStore.tradeStore.direction).toBe('long')
  })

  it('should change selected pool to short pool when selecting a short direction', () => {
    rootStore.tradeStore.setDirection('short', selectedMarket)
    if (!selectedMarket.selectedPool) return
    expect(selectedMarket.selectedPool.address).toBe(selectedMarket.shortPool?.address)
  })

  it('should select the amount to be traded', () => {
    rootStore.tradeStore.setOpenTradeAmount(amountToTrade)
    expect(rootStore.tradeStore.openTradeAmount).toBe(amountToTrade)
  })

  it('should allow decimals input', () => {
    rootStore.tradeStore.setOpenTradeAmount('100.123')
    expect(rootStore.tradeStore.openTradeAmount).toBe('100.123')
  })

  it('should disable button if amount is larger than balance', () => {
    const tradeAmount = '3000.50'
    rootStore.tradeStore.setOpenTradeAmount(tradeAmount)
    expect(rootStore.tradeStore.openTradeAmount).toBe(tradeAmount)
    expect(rootStore.tradeStore.tradeDisabled).toBe(true)
  })

  it('should not disable button if amount is smaller than balance', () => {
    rootStore.tradeStore.setOpenTradeAmount('100')
    expect(rootStore.tradeStore.tradeDisabled).toBe(false)
  })

  describe('opening a trade', () => {
    if (!selectedMarket.selectedPool) return

    const mock: any = (): jest.Mock<void> => jest.fn()
    const spyExactInput = jest
      .spyOn(rootStore.uniswapRouterStore, 'exactInput')
      .mockImplementation(mock)
    const spyPool = jest.spyOn(selectedMarket.selectedPool, 'pool', 'get').mockReturnValue(poolMock)

    it('should have the right amount when opening a trade', () => {
      const openTradeParameters = spyExactInput.mock.calls[0][0][0]
      expect(openTradeParameters.amountIn).toStrictEqual(parseEther(`${amountToTrade}`))
    })

    it('should call UniswapRouter exactInput when opening a trade', () => {
      rootStore.tradeStore.openTrade(selectedMarket)
      expect(rootStore.uniswapRouterStore.exactInput).toHaveBeenCalledTimes(1)
    })

    spyPool.mockRestore()
    spyExactInput.mockRestore()
  })

  describe('closing a trade', () => {
    if (!selectedMarket.selectedPool) return
    const mockToken = new Erc20Store({ root: rootStore, tokenName: 'PREFAKETOKEN_LONG_TOKEN' })

    const mock: any = (): jest.Mock<void> => jest.fn()
    const spyExactOutput = jest
      .spyOn(rootStore.uniswapRouterStore, 'exactInput')
      .mockImplementation(mock)

    it('should have the right amount to sell when closing a trade', () => {
      const openTradeParameters = spyExactOutput.mock.calls[0][0][0]
      expect(openTradeParameters.amountIn).toStrictEqual(parseEther(`${amountToTrade}`))
    })

    it('should call UniswapRouter exactOutput when closing a trade', () => {
      rootStore.tradeStore.closeTrade(
        mockToken,
        BigNumber.from(amountToTrade),
        BigNumber.from(200),
        selectedMarket
      )
      expect(rootStore.uniswapRouterStore.exactOutput).toHaveBeenCalledTimes(1)
    })

    spyExactOutput.mockRestore()
  })
})

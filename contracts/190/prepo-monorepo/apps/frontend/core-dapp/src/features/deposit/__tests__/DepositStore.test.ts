/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, utils } from 'ethers'
import { configure } from 'mobx'
import { ERC20_UNITS } from '../../../lib/constants'
import { MarketEntity } from '../../../stores/entities/MarketEntity'
import { markets } from '../../../lib/markets'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const selectedMarket = new MarketEntity(rootStore, markets[0])
const amountToDeposit = '1000.0'
const USDC_BALANCE = 2000

beforeAll(() => {
  selectedMarket.fetchPools()
})

describe('DepositStore tests', () => {
  let spyBaseTokenBalance: jest.SpyInstance
  beforeAll(() => {
    spyBaseTokenBalance = jest
      .spyOn(rootStore.baseTokenStore, 'tokenBalance', 'get')
      .mockReturnValue(USDC_BALANCE)

    const USDC_BALANCE_BIGNUMBER = rootStore.baseTokenStore.parseUnits(
      `${USDC_BALANCE}`
    ) as BigNumber

    jest
      .spyOn(rootStore.baseTokenStore, 'tokenBalanceRaw', 'get')
      .mockReturnValue(USDC_BALANCE_BIGNUMBER)
  })

  afterAll(() => {
    spyBaseTokenBalance.mockRestore()
  })

  it('should set the amount', () => {
    rootStore.depositStore.setDepositAmount(amountToDeposit)
    expect(rootStore.depositStore.depositAmount).toBe(amountToDeposit)
  })

  it('should disable button if amount is larger than balance', () => {
    rootStore.depositStore.setDepositAmount('10000')
    expect(rootStore.depositStore.depositDisabled).toBe(true)
  })

  it('should not disable button if amount is smaller than balance', () => {
    rootStore.depositStore.setDepositAmount('100')
    expect(rootStore.depositStore.depositDisabled).toBe(false)
  })

  describe('deposit', () => {
    const mock: any = (): jest.Mock<void> => jest.fn()
    let spyDeposit: jest.SpyInstance

    beforeEach(() => {
      rootStore.depositStore.setDepositAmount(amountToDeposit)
      spyDeposit = jest.spyOn(rootStore.preCTTokenStore, 'deposit')
      spyDeposit.mockImplementation(mock)
      rootStore.depositStore.deposit()
    })

    afterEach(() => {
      spyDeposit.mockRestore()
    })

    it('should call deposit method on the collateral contract when depositing', () => {
      expect(rootStore.preCTTokenStore.deposit).toHaveBeenCalledTimes(1)
    })

    it('should match same amount to deposit to the one sent to the collateral contract', () => {
      const depositParameters = spyDeposit.mock.calls[0][0]
      expect(utils.formatUnits(depositParameters, ERC20_UNITS)).toBe(amountToDeposit)
    })
  })
})

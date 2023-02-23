/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseUnits } from 'ethers/lib/utils'
import { configure } from 'mobx'

// This is needed to be able to mock mobx properties on a class
configure({ safeDescriptors: false })

const { rootStore } = global
const PPO_BALANCE = '2000'
const PPO_DECIMALS = 18
const STAKE_VALUE = '100'
const EXCEED_BALANCE = `${+PPO_BALANCE + +STAKE_VALUE}`

let spyInstance: jest.SpyInstance
let spyPPOTokenDecimalsNumber: jest.SpyInstance

beforeAll(() => {
  spyInstance = jest
    .spyOn(rootStore.ppoTokenStore, 'tokenBalanceRaw', 'get')
    .mockReturnValue(parseUnits(PPO_BALANCE, PPO_DECIMALS))

  spyPPOTokenDecimalsNumber = jest
    .spyOn(rootStore.ppoTokenStore, 'decimalsNumber', 'get')
    .mockReturnValue(PPO_DECIMALS)
})

afterAll(() => {
  spyInstance.mockRestore()
  spyPPOTokenDecimalsNumber.mockRestore()
})

describe('StakeStore tests', () => {
  it('should have proper state after input changes', () => {
    rootStore.stakeStore.setCurrentStakingValue(STAKE_VALUE)
    expect(rootStore.stakeStore.currentStakingValue).toBe(STAKE_VALUE)
  })

  it('should allow to stake', async () => {
    const result = await rootStore.stakeStore.stake()
    expect(result).toStrictEqual({ success: true })
  })

  it('should verify input value and do nothing if value is less than balance', () => {
    expect(rootStore.stakeStore.currentStakingValue).toBe(STAKE_VALUE)
  })

  it('should set isCurrentStakingValueValid to true when currentStakingValue is NOT 0', () => {
    expect(rootStore.stakeStore.isCurrentStakingValueValid).toBe(true)
  })

  it('should NOT allow to stake', async () => {
    rootStore.stakeStore.setCurrentStakingValue(EXCEED_BALANCE)
    const result = await rootStore.stakeStore.stake()
    expect(result).toStrictEqual({ success: false })
  })

  it('should verify input value and do nothing if value is more than balance', () => {
    expect(rootStore.stakeStore.currentStakingValue).toBe(EXCEED_BALANCE)
  })

  it('should set isCurrentStakingValueValid to false when currentStakingValue is 0', () => {
    rootStore.stakeStore.setCurrentStakingValue('0')
    expect(rootStore.stakeStore.isCurrentStakingValueValid).toBe(false)
  })
})

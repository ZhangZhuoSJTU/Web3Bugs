import { addDays } from 'date-fns'
import { BigNumber } from 'ethers'
import { action, makeObservable, observable, reaction, runInAction } from 'mobx'
import { ContractReturn, Factory } from 'prepo-stores'
import { PPOStakingAbi, PPOStakingAbi__factory } from '../../../../generated/typechain'
import { BalanceStructOutput } from '../../../../generated/typechain/PPOStakingAbi'
import { Erc20Store } from '../../../stores/entities/Erc20.entity'
import { RootStore } from '../../../stores/RootStore'

type Stake = PPOStakingAbi['functions']['stake']
type StartCooldown = PPOStakingAbi['functions']['startCooldown']
type BalanceData = PPOStakingAbi['functions']['balanceData']
type Withdraw = PPOStakingAbi['functions']['withdraw']

// use this key to store balance in localStorage, while there's no SC
const MOCK_KEY = 'MOCK_BALANCE_DATA'

const TOKEN_SYMBOL = 'PPO_STAKING'

const EXIT_COOLDOWN = false // I don't see much use in current UI implementation

const MOCKED_CONFIG = {
  cooldownPeriod: 21, // 21 days cooldown period
  withdrawWindow: 7, // 7 days to withdraw - post-cooldown
  fee: 10.12, // Fee will calculated based on how long staking time length
}

// Storing data in localStorage - will allow us to test withdraw/startCooldown functionality
function getMockedBalance(address: string): BalanceStructOutput | undefined {
  const data = localStorage.getItem(MOCK_KEY)
  if (!data) return undefined
  const parsedData = JSON.parse(data) as { [key: string]: BalanceStructOutput }
  const balance = parsedData[address]
  if (!balance) {
    return undefined
  }
  return { ...balance, raw: BigNumber.from(balance.raw) }
}

export class PPOStakingStore extends Erc20Store {
  staking = false
  stakingHash?: string
  mockRawBalance?: BigNumber
  startingCooldown = false
  startingCooldownHash?: string
  endingCooldown = false
  endingCooldownHash?: string
  withdrawing = false
  withdrawHash?: string

  constructor(root: RootStore) {
    super({ root, tokenName: TOKEN_SYMBOL, factory: PPOStakingAbi__factory as unknown as Factory })
    this.symbolOverride = TOKEN_SYMBOL
    makeObservable(this, {
      staking: observable,
      stakingHash: observable,
      withdrawing: observable,
      withdrawHash: observable,
      startingCooldown: observable,
      startingCooldownHash: observable,
      endingCooldown: observable,
      endingCooldownHash: observable,
      stake: action.bound,
      mockRawBalance: observable,
      getBalanceData: observable,
      startCooldown: action.bound,
      endCooldown: action.bound,
      withdraw: action.bound,
    })
    this.subscribe()
  }

  // eslint-disable-next-line class-methods-use-this
  getBalanceData(...params: Parameters<BalanceData>): ContractReturn<BalanceData> {
    // return this.call<BalanceData>('balanceData', params)
    // TODO: Once SC is implemented uncomment above line, and remove lines below
    const balance = getMockedBalance(params[0])
    if (!balance) return undefined
    return [balance]
  }

  get balanceData(): BalanceStructOutput | undefined {
    const { address } = this.root.web3Store
    if (!address) {
      return undefined
    }
    const result = this.getBalanceData(address)
    if (result === undefined) return undefined
    return result[0]
  }

  get cooldownStarted(): Date | undefined {
    const cooldownStartedAt = this.balanceData?.cooldownTimestamp as unknown as number
    if (!cooldownStartedAt) return undefined

    return new Date(cooldownStartedAt)
  }

  get isCooldownActive(): boolean {
    if (!this.withdrawWindowStarted) return false
    return new Date() < this.withdrawWindowStarted
  }

  get withdrawWindowStarted(): Date | undefined {
    if (!this.cooldownStarted) return undefined
    return addDays(this.cooldownStarted, MOCKED_CONFIG.cooldownPeriod)
  }

  get isWithdrawWindowActive(): boolean {
    if (!this.withdrawWindowStarted) return false

    return (
      !this.isCooldownActive &&
      new Date() < addDays(this.withdrawWindowStarted, MOCKED_CONFIG.withdrawWindow)
    )
  }

  // eslint-disable-next-line class-methods-use-this
  get fee(): number {
    return MOCKED_CONFIG.fee
  }

  async stake(amount: BigNumber): Promise<{ success: boolean; error?: string }> {
    try {
      this.staking = true
      this.stakingHash = undefined
      const { address } = this.root.web3Store.signerState
      if (!address) {
        return {
          success: false,
          error: 'wallet is not connected',
        }
      }
      // const { hash, wait } = await this.sendTransaction<Stake>('stake', [address, amount])
      // TODO: Once SC is implemented uncomment above line, and remove lines below
      const mockStakeCall = (
        params: Parameters<Stake>
      ): Promise<{ hash: string; wait: () => Promise<void> }> =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                hash: 'SOME_MOCKED_HASH',
                wait: () => {
                  const balance = getMockedBalance(address)
                  const hexAmount = BigNumber.from(params[1])
                  if (balance) {
                    const record = { raw: BigNumber.from(balance.raw).add(hexAmount) }
                    const map = JSON.parse(localStorage.getItem(MOCK_KEY) ?? '{}')
                    map[address] = record
                    localStorage.setItem(MOCK_KEY, JSON.stringify(map))
                  } else {
                    localStorage.setItem(
                      MOCK_KEY,
                      JSON.stringify({ [address]: { raw: hexAmount } })
                    )
                  }
                  return Promise.resolve()
                },
              }),
            3000
          )
        })
      const { hash, wait } = await mockStakeCall([address, amount])
      this.stakingHash = hash
      await wait()
      return {
        success: true,
      }
    } catch (error) {
      this.root.toastStore.errorToast(`Error calling end cooldown`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    } finally {
      this.staking = false
    }
  }

  async startCooldown(amount: BigNumber): Promise<{ success: boolean; error?: string }> {
    try {
      this.startingCooldown = true
      this.startingCooldownHash = undefined

      const { address } = this.root.web3Store.signerState
      if (!address) {
        return {
          success: false,
          error: 'wallet is not connected',
        }
      }
      // const { hash, wait } = await this.sendTransaction<StartCooldown>('startCooldown', [address, amount])
      // TODO: Once SC is implemented uncomment above line, and remove lines below
      const mockStakeCall = (
        params: Parameters<StartCooldown>
      ): Promise<{ hash: string; wait: () => Promise<void> }> =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              hash: 'SOME_MOCKED_HASH',
              wait: () => {
                const balance = getMockedBalance(address)
                const hexAmount = BigNumber.from(params[0])
                if (balance) {
                  const record = {
                    ...balance,
                    cooldownUnits: BigNumber.from(balance.cooldownUnits ?? 0).add(hexAmount),
                    cooldownTimestamp: +new Date(),
                    raw: BigNumber.from(balance.raw).sub(hexAmount),
                  }
                  const map = JSON.parse(localStorage.getItem(MOCK_KEY) ?? '{}')
                  map[address] = record
                  localStorage.setItem(MOCK_KEY, JSON.stringify(map))
                }
                return Promise.resolve()
              },
            })
          }, 3000)
        })
      const { hash, wait } = await mockStakeCall([amount])
      this.startingCooldownHash = hash

      await wait()
      return {
        success: true,
      }
    } catch (error) {
      this.root.toastStore.errorToast(`Error calling start cooldown`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    } finally {
      this.startingCooldown = false
    }
  }

  async endCooldown(): Promise<{ success: boolean; error?: string }> {
    try {
      this.endingCooldown = true
      this.endingCooldownHash = undefined

      const { address } = this.root.web3Store.signerState
      if (!address) {
        return {
          success: false,
          error: 'wallet is not connected',
        }
      }
      // const { hash, wait } = await this.sendTransaction<EndCooldown>('endCooldown', [])
      // TODO: Once SC is implemented uncomment above line, and remove lines below
      const mockStakeCall = (): Promise<{ hash: string; wait: () => Promise<void> }> =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              hash: 'SOME_MOCKED_HASH',
              wait: () => {
                const balance = getMockedBalance(address)
                if (balance) {
                  const record = {
                    ...balance,
                    raw: BigNumber.from(balance.raw).add(BigNumber.from(balance.cooldownUnits)),
                    cooldownUnits: 0,
                    cooldownTimestamp: 0,
                  }
                  const map = JSON.parse(localStorage.getItem(MOCK_KEY) ?? '{}')
                  map[address] = record
                  localStorage.setItem(MOCK_KEY, JSON.stringify(map))
                }
                return Promise.resolve()
              },
            })
          }, 3000)
        })
      const { hash, wait } = await mockStakeCall()
      this.endingCooldownHash = hash
      await wait()
      return {
        success: true,
      }
    } catch (error) {
      this.root.toastStore.errorToast(`Error calling end cooldown`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    } finally {
      this.endingCooldown = false
    }
  }

  async withdraw(
    amount: BigNumber,
    immediate: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.withdrawing = true
      this.withdrawHash = undefined

      const { address } = this.root.web3Store.signerState
      if (!address) {
        return {
          success: false,
          error: 'wallet is not connected',
        }
      }
      // const { hash, wait } = await this.sendTransaction<Withdraw>('withdraw', [amount, address, EXIT_COOLDOWN, immediate])
      // TODO: Once SC is implemented uncomment above line, and remove lines below
      const mockStakeCall = (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        params: Parameters<Withdraw>
      ): Promise<{ hash: string; wait: () => Promise<void> }> =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              hash: 'SOME_MOCKED_HASH',
              wait: () => {
                const balance = getMockedBalance(address)
                if (balance) {
                  const record = {
                    ...balance,
                    raw: BigNumber.from(balance.raw).sub(BigNumber.from(params[0])),
                    cooldownUnits: 0,
                    cooldownTimestamp: 0,
                  }
                  const map = JSON.parse(localStorage.getItem(MOCK_KEY) ?? '{}')
                  map[address] = record
                  localStorage.setItem(MOCK_KEY, JSON.stringify(map))
                }
                return Promise.resolve()
              },
            })
          }, 3000)
        })
      const { hash, wait } = await mockStakeCall([amount, address, EXIT_COOLDOWN, immediate])
      this.withdrawHash = hash

      await wait()
      return {
        success: true,
      }
    } catch (error) {
      this.root.toastStore.errorToast(`Error calling withdraw`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    } finally {
      this.withdrawing = false
    }
  }

  subscribe(): void {
    // TODO: once there's SC - we don't need this subscription
    reaction(
      () => this.root.web3Store.address,
      (address) => {
        if (!address) return
        try {
          const balance = getMockedBalance(address)
          runInAction(() => {
            this.mockRawBalance = balance?.raw
          })
        } catch (error) {
          this.root.toastStore.errorToast(`Bad data`, error)
        }
      }
    )
  }
}

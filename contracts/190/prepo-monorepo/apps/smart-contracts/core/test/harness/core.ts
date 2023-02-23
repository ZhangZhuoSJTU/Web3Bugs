import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { MockContract } from '@defi-wonderland/smock'
import {
  Collateral,
  DepositHook,
  DepositRecord,
  ERC20,
  ManagerWithdrawHook,
  PrePOMarket,
  PrePOMarketFactory,
  TestERC20,
  WithdrawHook,
} from '../../typechain'
import { collateralFixture, smockCollateralFixture } from '../fixtures/CollateralFixture'
import {
  depositHookFixture,
  managerWithdrawHookFixture,
  smockDepositHookFixture,
  smockManagerWithdrawHookFixture,
  smockWithdrawHookFixture,
  withdrawHookFixture,
} from '../fixtures/HookFixture'
import { smockTestERC20Fixture, testERC20Fixture } from '../fixtures/TestERC20Fixture'
import { prePOMarketFactoryFixture } from '../fixtures/PrePOMarketFactoryFixture'

type CollateralWithHooks = (Collateral | MockContract) & {
  depositHook?: DepositHook | MockContract
  withdrawHook?: WithdrawHook | MockContract
  managerWithdrawHook?: ManagerWithdrawHook | MockContract
}

export class Core {
  private static _instance: Core
  public ethers!: HardhatEthersHelpers
  public accounts!: SignerWithAddress[]
  public baseToken: ERC20 | TestERC20 | MockContract
  public collateral: CollateralWithHooks | MockContract
  public depositRecord: DepositRecord | MockContract
  public marketFactory: PrePOMarketFactory
  public markets!: {
    [suffix: string]: {
      market: PrePOMarket | MockContract
      longToken: ERC20 | MockContract
      shortToken: ERC20 | MockContract
      hash: string
    }
  }

  public static get Instance(): Core {
    const instance = this._instance
    if (instance) {
      return instance
    }
    this._instance = new this()
    return this._instance
  }

  public async init(ethers: HardhatEthersHelpers, smocked: boolean): Promise<Core> {
    this.ethers = ethers
    this.accounts = await ethers.getSigners()
    this.baseToken = smocked
      ? await smockTestERC20Fixture('Test USDC', 'TUSDC', 6)
      : await testERC20Fixture('Test USDC', 'TUSDC', 6)
    this.collateral = smocked
      ? await smockCollateralFixture('prePO USDC Collateral', 'preUSDC', this.baseToken.address, 18)
      : await collateralFixture('prePO USDC Collateral', 'preUSDC', this.baseToken.address, 18)
    this.collateral.depositHook = smocked
      ? await smockDepositHookFixture()
      : await depositHookFixture()
    this.collateral.withdrawHook = smocked
      ? await smockWithdrawHookFixture()
      : await withdrawHookFixture()
    this.collateral.managerWithdrawHook = smocked
      ? await smockManagerWithdrawHookFixture()
      : await managerWithdrawHookFixture()
    this.marketFactory = await prePOMarketFactoryFixture()
    this.markets = {}
    return this
  }
}

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { Contract } from 'ethers'
import { DEPLOYMENT_NAMES } from 'prepo-constants'

export type ContractWithName = {
  name: string
  contract: Contract
}

export type RestrictedTransferHookWithLists = ContractWithName & {
  blocklist: ContractWithName
  sourceAllowlist: ContractWithName
  destinationAllowlist: ContractWithName
}

export type PPOWithHooks = ContractWithName & {
  restrictedTransferHook: RestrictedTransferHookWithLists
}

export type AllowlistPurchaseHookWithLists = ContractWithName & {
  allowlist: ContractWithName
}

export type MiniSalesWithHooks = ContractWithName & {
  allowlistPurchaseHook: AllowlistPurchaseHookWithLists
}

export class Token {
  private static _instance: Token
  private initialising!: Promise<Token>
  public ethers!: HardhatEthersHelpers
  public chainId!: string
  public accounts!: SignerWithAddress[]
  public ppo: PPOWithHooks
  public miniSales: MiniSalesWithHooks
  public vesting: ContractWithName
  public miniSalesFlag: ContractWithName

  public static get Instance(): Token {
    if (!this._instance) {
      this._instance = new this()
    }
    return this._instance
  }

  public async init(chainId: string, ethers: HardhatEthersHelpers): Promise<Token> {
    this.chainId = chainId
    this.ethers = ethers
    this.accounts = await ethers.getSigners()
    const fetchedPPOContracts = await Promise.all([
      await ethers.getContract(DEPLOYMENT_NAMES.ppo.name),
      await ethers.getContract(DEPLOYMENT_NAMES.ppo.restrictedTransferHook.name),
      await ethers.getContract(DEPLOYMENT_NAMES.ppo.restrictedTransferHook.blocklist.name),
      await ethers.getContract(DEPLOYMENT_NAMES.ppo.restrictedTransferHook.sourceAllowlist.name),
      await ethers.getContract(
        DEPLOYMENT_NAMES.ppo.restrictedTransferHook.destinationAllowlist.name
      ),
    ])
    this.ppo = {
      name: DEPLOYMENT_NAMES.ppo.name,
      contract: fetchedPPOContracts[0],
      restrictedTransferHook: {
        name: DEPLOYMENT_NAMES.ppo.restrictedTransferHook.name,
        contract: fetchedPPOContracts[1],
        blocklist: {
          name: DEPLOYMENT_NAMES.ppo.restrictedTransferHook.blocklist.name,
          contract: fetchedPPOContracts[2],
        },
        sourceAllowlist: {
          name: DEPLOYMENT_NAMES.ppo.restrictedTransferHook.sourceAllowlist.name,
          contract: fetchedPPOContracts[3],
        },
        destinationAllowlist: {
          name: DEPLOYMENT_NAMES.ppo.restrictedTransferHook.destinationAllowlist.name,
          contract: fetchedPPOContracts[4],
        },
      },
    }
    const fetchedMiniSalesContracts = await Promise.all([
      await ethers.getContract(DEPLOYMENT_NAMES.miniSales_A.name),
      await ethers.getContract(DEPLOYMENT_NAMES.miniSales_A.allowlistPurchaseHook.name),
      await ethers.getContract(DEPLOYMENT_NAMES.miniSales_A.allowlistPurchaseHook.allowlist.name),
    ])
    this.miniSales = {
      name: DEPLOYMENT_NAMES.miniSales_A.name,
      contract: fetchedMiniSalesContracts[0],
      allowlistPurchaseHook: {
        name: DEPLOYMENT_NAMES.miniSales_A.allowlistPurchaseHook.name,
        contract: fetchedMiniSalesContracts[1],
        allowlist: {
          name: DEPLOYMENT_NAMES.miniSales_A.allowlistPurchaseHook.allowlist.name,
          contract: fetchedMiniSalesContracts[2],
        },
      },
    }
    this.vesting = {
      name: DEPLOYMENT_NAMES.vesting.name,
      contract: await ethers.getContract(DEPLOYMENT_NAMES.vesting.name),
    }
    this.miniSalesFlag = {
      name: DEPLOYMENT_NAMES.miniSalesFlag_A.name,
      contract: await ethers.getContract(DEPLOYMENT_NAMES.miniSalesFlag_A.name),
    }
    return this
  }
}

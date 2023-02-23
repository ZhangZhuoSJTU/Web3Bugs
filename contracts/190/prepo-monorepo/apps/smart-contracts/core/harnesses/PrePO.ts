// TODO: selectively remove/replace collateral related methods with preUSD
// import { BigNumber } from '@ethersproject/bignumber'
// import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
// import { id } from 'ethers/lib/utils'
// import { parseEther } from '@ethersproject/units'
// import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
// import { ContractFactory, ContractTransaction } from 'ethers'
// import { fetchExistingCollateral, fetchExistingPrePOMarketFactory } from '../helpers'
// import { FEE_DENOMINATOR } from '../utils'
// import {
//   MockStrategy,
//   Collateral,
//   PrePOMarket,
//   PrePOMarketFactory,
//   SingleStrategyController,
//   TestBaseToken,
//   DepositRecord,
//   DepositHook,
//   WithdrawHook,
// } from '../typechain'

// export type CreateMarketParams = {
//   tokenNameSuffix: string
//   tokenSymbolSuffix: string
//   governance: string
//   floorLongPrice: BigNumber
//   ceilingLongPrice: BigNumber
//   floorValuation: number
//   ceilingValuation: number
//   mintingFee: number
//   redemptionFee: number
//   expiryTime: number
// }

// export const TWO_POW_96 = BigNumber.from(2).pow(96)
// export const TEST_BT_SUPPLY = parseEther('1000000000')
// export const TEST_DEPOSIT_CAP = parseEther('100000')
// export const TEST_MINTING_FEE = 5000
// export const TEST_REDEMPTION_FEE = 5000

// export class PrePO {
//   private static _instance: PrePO
//   private initialising!: Promise<PrePO>
//   public ethers!: HardhatEthersHelpers
//   public chainId!: string
//   public accounts!: SignerWithAddress[]
//   public baseToken!: TestBaseToken
//   public mockStrategy!: MockStrategy
//   public collateral!: Collateral
//   public marketFactory!: PrePOMarketFactory
//   public strategyController!: SingleStrategyController
//   public depositHook!: DepositHook
//   public withdrawHook!: WithdrawHook
//   public depositRecord!: DepositRecord
//   public marketContractFactory!: ContractFactory
//   public positionContractFactory!: ContractFactory
//   public markets!: {
//     [suffix: string]: {
//       contract: PrePOMarket
//       hash: string
//     }
//   }

//   public static get Instance(): PrePO {
//     if (!this._instance) {
//       this._instance = new this()
//     }
//     return this._instance
//   }

//   public async init(chainId: string, ethers: HardhatEthersHelpers): Promise<PrePO> {
//     this.chainId = chainId
//     this.ethers = ethers
//     this.accounts = await ethers.getSigners()
//     this.baseToken = (await ethers.getContract('TestBaseToken')) as unknown as TestBaseToken
//     this.mockStrategy = (await ethers.getContract('MockStrategy')) as unknown as MockStrategy
//     this.collateral = await fetchExistingCollateral(chainId, ethers)
//     this.marketFactory = await fetchExistingPrePOMarketFactory(chainId, ethers)
//     this.depositHook = (await ethers.getContract('DepositHook')) as unknown as DepositHook
//     this.withdrawHook = (await ethers.getContract('WithdrawHook')) as unknown as WithdrawHook
//     this.strategyController = (await ethers.getContract(
//       'SingleStrategyController'
//     )) as unknown as SingleStrategyController
//     this.depositRecord = (await ethers.getContract(
//       'DepositRecord'
//     )) as unknown as DepositRecord
//     this.marketContractFactory = (await ethers.getContractFactory(
//       'PrePOMarket'
//     )) as unknown as ContractFactory
//     this.positionContractFactory = (await ethers.getContractFactory(
//       'LongShortToken'
//     )) as unknown as ContractFactory
//     return this
//   }

//   public async createMarket(params: CreateMarketParams): Promise<ContractTransaction> {
//     const tx = await this.marketFactory
//       .connect(this.accounts[0])
//       .createMarket(
//         params.tokenNameSuffix,
//         params.tokenSymbolSuffix,
//         params.governance,
//         this.collateral.address,
//         params.floorLongPrice,
//         params.ceilingLongPrice,
//         params.floorValuation,
//         params.ceilingValuation,
//         params.mintingFee,
//         params.redemptionFee,
//         params.expiryTime
//       )
//     return tx
//   }

//   public async getBaseTokenNeededForShares(shares: BigNumber): Promise<BigNumber> {
//     const amountFromShares = await this.collateral.getAmountForShares(shares)
//     return amountFromShares
//       .mul(FEE_DENOMINATOR)
//       .div(FEE_DENOMINATOR.sub(await this.collateral.getMintingFee()))
//       .add(1)
//   }
// }

// export async function getCollateralNeededForPosition(
//   market: PrePOMarket,
//   amount: BigNumber
// ): Promise<BigNumber> {
//   return amount
//     .mul(FEE_DENOMINATOR)
//     .div(FEE_DENOMINATOR.sub(await market.getMintingFee()))
//     .add(1)
// }

// /* eslint-disable @typescript-eslint/no-explicit-any */
// export async function getMarketAddedEvent(factory: PrePOMarketFactory): Promise<any> {
//   const filter = {
//     address: factory.address,
//     topics: [id('MarketAdded(address,bytes32)')],
//   }
//   const events = await factory.queryFilter(filter, 'latest')
//   return events[0].args as any
// }
// /* eslint-enable @typescript-eslint/no-explicit-any */

// export async function getMintingFee(
//   contract: Collateral | PrePOMarket,
//   amount: BigNumber
// ): Promise<BigNumber> {
//   return amount
//     .mul(await contract.getMintingFee())
//     .div(FEE_DENOMINATOR.sub(await contract.getMintingFee()))
//     .add(1)
// }

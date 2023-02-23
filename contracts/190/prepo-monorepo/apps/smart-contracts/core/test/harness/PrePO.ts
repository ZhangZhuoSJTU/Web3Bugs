// TODO: selectively remove/replace collateral related methods with preUSD

// import { BigNumber } from '@ethersproject/bignumber'
// import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
// import { ethers, upgrades } from 'hardhat'
// import { ContractFactory } from 'ethers'
// import { parseEther } from '@ethersproject/units'
// import { utils } from 'prepo-hardhat'
// import { getFactories } from './helpers'
// import {
//   MockStrategy,
//   Collateral,
//   PrePOMarket,
//   PrePOMarketFactory,
//   SingleStrategyController,
//   MockERC20,
//   DepositRecord,
// } from '../../typechain'
// import { getMarketAddedEvent } from '../events'
// import { FEE_DENOMINATOR } from '../utils'
// import { depositHookFixture, withdrawHookFixture } from '../fixtures/HookFixture'
// import { depositRecordFixture } from '../fixtures/DepositRecordFixture'

// const { setNextTimestamp } = utils

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
// export const TEST_GLOBAL_DEPOSIT_CAP = parseEther('100000')
// export const TEST_ACCOUNT_DEPOSIT_CAP = parseEther('10000')
// export const TEST_MINTING_FEE = 5000
// export const TEST_REDEMPTION_FEE = 5000

// export async function getCollateralNeededForPosition(
//   market: PrePOMarket,
//   amount: BigNumber
// ): Promise<BigNumber> {
//   return amount
//     .mul(FEE_DENOMINATOR)
//     .div(FEE_DENOMINATOR - (await market.getMintingFee()).toNumber())
//     .add(1)
// }

// export class PrePO {
//   private static _instance: PrePO
//   private initialising!: Promise<PrePO>
//   public accounts!: SignerWithAddress[]
//   public baseToken!: MockERC20
//   public mockStrategy!: MockStrategy
//   public collateral!: Collateral
//   public depositRecord!: DepositRecord
//   public marketFactory!: PrePOMarketFactory
//   public strategyController!: SingleStrategyController
//   public markets!: {
//     [suffix: string]: {
//       contract: PrePOMarket
//       hash: string
//     }
//   }

//   public static get Instance(): PrePO {
//     const instance = this._instance
//     if (instance) {
//       return instance
//     }
//     this._instance = new this()
//     return this._instance
//   }

//   public async init(): Promise<PrePO> {
//     this.accounts = await ethers.getSigners()
//     const [mockERC20, mockStrategy, collateral, prePOMarketFactory, singleStrategyController] =
//       await Promise.all(
//         getFactories([
//           'MockERC20',
//           'MockStrategy',
//           'Collateral',
//           'PrePOMarketFactory',
//           'SingleStrategyController',
//         ])
//       )
//     await this.deployBaseToken(mockERC20)
//     await this.deployCollateral(collateral)
//     await this.deploySingleStrategyController(singleStrategyController)
//     await this.deployMockStrategy(mockStrategy)
//     await this.deployMarketFactory(prePOMarketFactory)
//     this.markets = {}
//     return this
//   }

//   public async createMarket(params: CreateMarketParams): Promise<void> {
//     await this.marketFactory
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
//     const events = await getMarketAddedEvent(this.marketFactory)
//     const prePOMarket = await ethers.getContractFactory('PrePOMarket')
//     this.markets[params.tokenNameSuffix] = {
//       contract: prePOMarket.attach(events.market) as unknown as PrePOMarket,
//       hash: events.longShortHash,
//     }
//   }

//   private async deployBaseToken(mockERC20: ContractFactory): Promise<void> {
//     this.baseToken = (await mockERC20.deploy('Base Token', 'BT')) as MockERC20
//     await this.baseToken.mint(this.accounts[0].address, TEST_BT_SUPPLY)
//   }

//   private async deployCollateral(collateral: ContractFactory): Promise<void> {
//     this.collateral = (await upgrades.deployProxy(collateral, [
//       this.baseToken.address,
//       this.accounts[0].address,
//     ])) as Collateral
//     await this.collateral.setMintingFee(TEST_MINTING_FEE)
//     await this.collateral.setRedemptionFee(TEST_REDEMPTION_FEE)
//     this.depositRecord = await depositRecordFixture(
//       TEST_GLOBAL_DEPOSIT_CAP,
//       TEST_ACCOUNT_DEPOSIT_CAP
//     )
//     const depositHook = await depositHookFixture(this.depositRecord.address)
//     const withdrawHook = await withdrawHookFixture(this.depositRecord.address)
//     await depositHook.setVault(this.collateral.address)
//     await withdrawHook.setVault(this.collateral.address)
//     await this.depositRecord.setAllowedHook(depositHook.address, true)
//     await this.depositRecord.setAllowedHook(withdrawHook.address, true)
//     await this.collateral.setDepositHook(depositHook.address)
//     await this.collateral.setWithdrawHook(withdrawHook.address)
//     await this.collateral.setDepositsAllowed(true)
//     await this.collateral.setWithdrawalsAllowed(true)
//   }

//   private async deploySingleStrategyController(
//     singleStrategyController: ContractFactory
//   ): Promise<void> {
//     this.strategyController = (await singleStrategyController.deploy(
//       this.baseToken.address
//     )) as SingleStrategyController
//     await this.strategyController.setVault(this.collateral.address)
//     await this.collateral.setStrategyController(this.strategyController.address)
//   }

//   private async deployMockStrategy(mockStrategy: ContractFactory): Promise<void> {
//     this.mockStrategy = (await mockStrategy.deploy(
//       this.strategyController.address,
//       this.baseToken.address
//     )) as MockStrategy
//     await this.mockStrategy.setVault(this.collateral.address)
//     await this.mockStrategy.transferOwnership(this.accounts[0].address)
//     await this.baseToken.transferOwnership(this.mockStrategy.address)
//     await this.strategyController.migrate(this.mockStrategy.address)
//   }

//   private async deployMarketFactory(prePOMarketFactory: ContractFactory): Promise<void> {
//     this.marketFactory = (await upgrades.deployProxy(prePOMarketFactory, [])) as PrePOMarketFactory
//     await this.marketFactory.setCollateralValidity(this.collateral.address, true)
//   }

//   public async setupApyAndBeginning(apy: number): Promise<number> {
//     await this.mockStrategy.setApy(apy)
//     const blockNumBefore = await ethers.provider.getBlockNumber()
//     const blockBefore = await ethers.provider.getBlock(blockNumBefore)
//     await this.mockStrategy.setBeginning(blockBefore.timestamp)
//     return blockBefore.timestamp
//   }

//   public async getBaseTokenNeededForCollateral(
//     mintTime: number,
//     shares: BigNumber
//   ): Promise<BigNumber> {
//     if ((await this.collateral.totalSupply()).gt(0)) {
//       const returnPerSecond = ethers.utils
//         .parseEther('1')
//         .mul(await this.mockStrategy.apy())
//         .div(100)
//         .div(31536000)
//       const timeElapsed = BigNumber.from(mintTime).sub(await this.mockStrategy.beginning())
//       const expectedShareValue = ethers.utils.parseEther('1').add(returnPerSecond.mul(timeElapsed))
//       const currentTotalValue = (await this.collateral.totalSupply())
//         .mul(expectedShareValue)
//         .div(ethers.utils.parseEther('1'))
//       const estimatedAmount = shares
//         .mul(expectedShareValue)
//         .mul(FEE_DENOMINATOR)
//         .div(FEE_DENOMINATOR - (await this.collateral.getMintingFee()).toNumber())
//         .div(ethers.utils.parseEther('1'))
//         .add(1)
//       /**
//        * This helper function calculates the amount of Base Token needed
//        * to mint a desired amount, taking into account the deposit fee.
//        * Because we are reverse engineering the amount needed for the eventual
//        * amount of shares, the calculations we perform here differ from what
//        * is in the helper contract. This can cause rounding issues where the
//        * actual amount minted is +/- 1 from the amount we expect. The following
//        * check is to auto-adjust the amount.
//        */
//       const feeFromEstimate = estimatedAmount
//         .mul(await this.collateral.getMintingFee())
//         .div(FEE_DENOMINATOR)
//         .add(1)
//       const estimatedAfterFee = estimatedAmount.sub(feeFromEstimate)
//       const sharesFromEstimate = estimatedAfterFee
//         .mul(await this.collateral.totalSupply())
//         .div(currentTotalValue)
//       if (sharesFromEstimate.gt(shares)) {
//         return estimatedAmount.sub(1)
//       }
//       if (sharesFromEstimate.lt(shares)) {
//         return estimatedAmount.add(1)
//       }
//       return estimatedAmount
//     }
//     return shares
//       .mul(FEE_DENOMINATOR)
//       .div(FEE_DENOMINATOR - (await this.collateral.getMintingFee()).toNumber())
//       .add(1)
//   }

//   public async fundLongShortPosition(
//     user: SignerWithAddress,
//     mintTime: number,
//     amount: BigNumber,
//     market: PrePOMarket
//   ): Promise<void> {
//     const collateralNeeded = await getCollateralNeededForPosition(market, amount)
//     const baseTokenNeeded = await this.getBaseTokenNeededForCollateral(mintTime, collateralNeeded)
//     await this.checkDepositCapacity(user, baseTokenNeeded)

//     const deployer = this.accounts[0]
//     if (baseTokenNeeded.gt(await this.baseToken.balanceOf(deployer.address))) {
//       throw new Error('Not enough BaseToken minted for deployer to fund collateral')
//     }
//     if (user.address !== deployer.address) {
//       await this.baseToken.connect(deployer).transfer(user.address, baseTokenNeeded)
//     }

//     await this.baseToken.connect(user).approve(this.collateral.address, baseTokenNeeded)
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     await setNextTimestamp(ethers.provider as any, mintTime)
//     await this.collateral.connect(user).deposit(baseTokenNeeded)
//     if ((await market.connect(deployer).isPublicMintingAllowed()) === false) {
//       await market.connect(deployer).setPublicMinting(true)
//     }

//     if (amount.gt(0)) {
//       await this.collateral.connect(user).approve(market.address, collateralNeeded)
//       await market.connect(user).mintLongShortTokens(collateralNeeded)
//     }
//   }

//   public async fundCollateral(
//     user: SignerWithAddress,
//     mintTime: number,
//     amount: BigNumber
//   ): Promise<void> {
//     const baseTokenNeeded = await this.getBaseTokenNeededForCollateral(mintTime, amount)
//     await this.checkDepositCapacity(user, baseTokenNeeded)

//     const deployer = this.accounts[0]
//     if (baseTokenNeeded.gt(await this.baseToken.balanceOf(deployer.address))) {
//       throw new Error('Not enough BaseToken minted for deployer to fund collateral')
//     }
//     if (user.address !== deployer.address) {
//       await this.baseToken.connect(deployer).transfer(user.address, baseTokenNeeded)
//     }

//     await this.baseToken.connect(user).approve(this.collateral.address, baseTokenNeeded)
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     await setNextTimestamp(ethers.provider as any, mintTime)
//     await this.collateral.connect(user).deposit(baseTokenNeeded)
//   }

//   public async checkDepositCapacity(
//     user: SignerWithAddress,
//     baseTokenToDeposit: BigNumber
//   ): Promise<void> {
//     const accountDepositCapacity = (await this.depositRecord.getAccountDepositCap()).sub(
//       await this.depositRecord.getNetDeposit(user.address)
//     )
//     if (baseTokenToDeposit.gt(accountDepositCapacity)) {
//       throw new Error("BaseToken needed exceeds the user's deposit cap")
//     }
//     const totalDepositCapacity = (await this.depositRecord.getGlobalDepositCap()).sub(
//       await this.depositRecord.getGlobalDepositAmount()
//     )
//     if (baseTokenToDeposit.gt(totalDepositCapacity)) {
//       throw new Error("BaseToken needed exceeds the vault's total capacity")
//     }
//   }
// }

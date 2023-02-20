import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import {
    MockERC20,
    TestCollateral,
    SingleStrategyController,
    MockStrategy,
    CollateralDepositRecord,
} from '../typechain'
import { mockERC20Fixture } from './fixtures/MockERC20Fixture'
import { testCollateralFixture } from './fixtures/CollateralFixture'
import { singleStrategyControllerFixture } from './fixtures/SingleStrategyControllerFixture'
import { mockStrategyFixture } from './fixtures/MockStrategyFixture'
import {
    AddressZero,
    FEE_LIMIT,
    calculateFee,
    returnFromMockAPY,
    setNextTimestamp,
    getLastTimestamp,
    getLastBlockNumber,
    mineBlocks,
    mineBlock,
    revertReason,
} from './utils'
import {
    getStrategyControllerChangedEvent,
    getCollateralMintingFeeChangedEvent,
    getCollateralRedemptionFeeChangedEvent,
    getDelayedWithdrawalExpiryChangedEvent,
    getDepositHookChangedEvent,
    getWithdrawHookChangedEvent,
    getDepositsAllowedChangedEvent,
    getWithdrawalsAllowedChangedEvent,
} from './events'
import { BigNumber, Contract } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import {
    smockDepositHookFixture,
    smockWithdrawHookFixture,
} from './fixtures/HookFixture'
import { collateralDepositRecordFixture } from './fixtures/CollateralDepositRecordFixture'
import { MockContract, smock } from '@defi-wonderland/smock'
import { smockAccountAccessControllerFixture } from './fixtures/AccountAccessControllerFixture'

chai.use(solidity)
chai.use(smock.matchers)

describe('=> Collateral', () => {
    let baseToken: MockERC20
    let collateral: TestCollateral
    let strategyController: SingleStrategyController
    let mockStrategy: MockStrategy
    let accounts: SignerWithAddress[]
    let deployer: SignerWithAddress
    let user: SignerWithAddress
    let treasury: SignerWithAddress
    let governance: SignerWithAddress
    let depositRecord: CollateralDepositRecord
    let mockAccountAccessController: MockContract<Contract>
    let mockDepositHook: MockContract<Contract>
    let mockWithdrawHook: MockContract<Contract>
    let setupControllerAndStrategy: () => Promise<void>
    let setupApyAndBeginning: (apy: number) => Promise<number>
    let transferAndApproveForDeposit: (
        approver: SignerWithAddress,
        spender: string,
        amount: BigNumber
    ) => Promise<void>
    let sharesMinted: (amount: BigNumber) => Promise<BigNumber>
    let mintCollateralToWithdraw: (
        minter: SignerWithAddress,
        amount: BigNumber
    ) => Promise<BigNumber>
    const TEST_APY = 7
    const TEST_TIMESTAMP_DELAY = 10
    const TEST_MINTING_FEE = 10
    const TEST_REDEMPTION_FEE = 20
    const TEST_GLOBAL_DEPOSIT_CAP = parseEther('100000')
    const TEST_ACCOUNT_DEPOSIT_CAP = parseEther('25000')
    const MOCK_BASE_TOKEN_SUPPLY = parseEther('1000000000')

    beforeEach(async () => {
        accounts = await ethers.getSigners()
        ;[deployer, user, treasury, governance] = await ethers.getSigners()
        baseToken = await mockERC20Fixture('Mock Base Token', 'MBT')
        collateral = await testCollateralFixture(
            baseToken.address,
            treasury.address
        )
        setupControllerAndStrategy = async () => {
            await baseToken.mint(deployer.address, MOCK_BASE_TOKEN_SUPPLY)
            strategyController = await singleStrategyControllerFixture(
                baseToken.address
            )
            await strategyController.setVault(collateral.address)
            mockStrategy = await mockStrategyFixture(
                strategyController.address,
                baseToken.address
            )
            await mockStrategy.setVault(collateral.address)
            await mockStrategy.transferOwnership(governance.address)
            await baseToken.transferOwnership(mockStrategy.address)
            await strategyController.migrate(mockStrategy.address)
            await collateral.setStrategyController(strategyController.address)
            await collateral.setMintingFee(TEST_MINTING_FEE)
            await collateral.setRedemptionFee(TEST_REDEMPTION_FEE)
            // Setup hook for Collateral deposits
            mockAccountAccessController =
                await smockAccountAccessControllerFixture()
            await mockAccountAccessController.allowAccounts([
                deployer.address,
                user.address,
                treasury.address,
                governance.address,
            ])
            depositRecord = await collateralDepositRecordFixture(
                TEST_GLOBAL_DEPOSIT_CAP,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            mockDepositHook = await smockDepositHookFixture(
                mockAccountAccessController.address,
                depositRecord.address
            )
            mockWithdrawHook = await smockWithdrawHookFixture(
                depositRecord.address
            )
            await mockDepositHook.setVault(collateral.address)
            await mockWithdrawHook.setVault(collateral.address)
            await depositRecord.setAllowedHook(mockDepositHook.address, true)
            await depositRecord.setAllowedHook(mockWithdrawHook.address, true)
            await collateral.setDepositsAllowed(true)
            await collateral.setWithdrawalsAllowed(true)
        }

        setupApyAndBeginning = async (apy: number) => {
            await mockStrategy.connect(governance).setApy(apy)
            const lastTimeStamp = await getLastTimestamp()
            await mockStrategy.connect(governance).setBeginning(lastTimeStamp)
            return lastTimeStamp
        }

        transferAndApproveForDeposit = async (
            approver: SignerWithAddress,
            spender: string,
            amount: BigNumber
        ) => {
            await baseToken.transfer(approver.address, amount)
            await baseToken.connect(approver).approve(spender, amount)
        }

        sharesMinted = async (amount: BigNumber) => {
            return amount
                .mul(await collateral.totalSupply())
                .div(await mockStrategy.totalValue())
        }

        mintCollateralToWithdraw = async (
            minter: SignerWithAddress,
            amount: BigNumber
        ) => {
            await transferAndApproveForDeposit(
                minter,
                collateral.address,
                amount
            )
            await collateral.connect(minter).deposit(amount)
            return await collateral.balanceOf(minter.address)
        }
    })

    describe('# initialize', () => {
        it('should be initialized with correct values', async () => {
            expect(await collateral.name()).to.eq('prePO Collateral Token')
            expect(await collateral.symbol()).to.eq('preCT')
            expect(await collateral.getBaseToken()).to.eq(baseToken.address)
            expect(await collateral.getTreasury()).to.eq(treasury.address)
            expect(await collateral.getMintingFee()).to.eq(0)
            expect(await collateral.getRedemptionFee()).to.eq(0)
            expect(await collateral.getFeeDenominator()).to.eq(1000000)
            expect(await collateral.getFeeLimit()).to.eq(50000)
        })

        it('owner should be set to deployer', async () => {
            expect(await collateral.owner()).to.eq(deployer.address)
        })
    })

    describe('# totalAssets', () => {
        it('should report sum of latent contract balance and value reported by strategy', async () => {
            await setupControllerAndStrategy()
            await setupApyAndBeginning(TEST_APY)
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            await collateral.connect(user).deposit(TEST_ACCOUNT_DEPOSIT_CAP)
            await baseToken.transfer(
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const collateralBalance = await baseToken.balanceOf(
                collateral.address
            )
            const strategyValue = await mockStrategy.totalValue()

            expect(await collateral.totalAssets()).to.eq(
                collateralBalance.add(strategyValue)
            )
        })
    })

    describe('# getAmountForShares', () => {
        const sharesToQuote = ethers.utils.parseEther('150')
        it('should return shares at 1:1 ratio if totalSupply is zero', async () => {
            await setupControllerAndStrategy()
            await setupApyAndBeginning(TEST_APY)
            await baseToken.transfer(
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            expect(await baseToken.balanceOf(collateral.address)).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            expect(await collateral.totalSupply()).to.eq(0)

            expect(await collateral.getAmountForShares(sharesToQuote)).to.eq(
                sharesToQuote
            )
        })

        it('should return estimated Collateral received based on current contract assets', async () => {
            await setupControllerAndStrategy()
            await setupApyAndBeginning(TEST_APY)
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            await collateral.connect(user).deposit(TEST_ACCOUNT_DEPOSIT_CAP)
            await baseToken.transfer(
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const collateralValue = await collateral.totalAssets()
            const collateralSupply = await collateral.totalSupply()

            expect(await collateral.getAmountForShares(sharesToQuote)).to.eq(
                sharesToQuote.mul(collateralValue).div(collateralSupply)
            )
        })
    })

    describe('# getSharesForAmount', () => {
        const amountToQuote = ethers.utils.parseEther('175')
        it('should return zero if total value of contract assets is zero', async () => {
            await setupControllerAndStrategy()
            await setupApyAndBeginning(TEST_APY)
            await baseToken.transfer(
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            expect(await baseToken.balanceOf(collateral.address)).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            expect(await collateral.totalSupply()).to.eq(0)

            expect(await collateral.getSharesForAmount(amountToQuote)).to.eq(0)
        })

        it('should return estimated Base Token received based on current contract assets', async () => {
            await setupControllerAndStrategy()
            await setupApyAndBeginning(TEST_APY)
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            await collateral.connect(user).deposit(TEST_ACCOUNT_DEPOSIT_CAP)
            await baseToken.transfer(
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const collateralValue = await collateral.totalAssets()
            const collateralSupply = await collateral.totalSupply()

            expect(await collateral.getSharesForAmount(amountToQuote)).to.eq(
                amountToQuote.mul(collateralSupply).div(collateralValue)
            )
        })
    })

    describe('# deposit', () => {
        beforeEach(async function () {
            await setupControllerAndStrategy()
            await collateral.setWithdrawHook(mockWithdrawHook.address)
            if (
                this.currentTest?.title !==
                "should not call depositHook if a hook isn't configured"
            ) {
                await collateral.setDepositHook(mockDepositHook.address)
            }
        })

        it("should not allow deposits when 'depositsAllowed' is set to false", async () => {
            await collateral.connect(deployer).setDepositsAllowed(false)
            expect(await collateral.getDepositsAllowed()).to.eq(false)
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP
            )

            await expect(
                collateral.connect(user).deposit(TEST_ACCOUNT_DEPOSIT_CAP)
            ).revertedWith(revertReason('Deposits not allowed'))
        })

        it('should not allow zero as a deposit amount', async () => {
            await expect(collateral.connect(user).deposit(0)).revertedWith(
                revertReason('Deposit amount too small')
            )
        })

        it('should not allow a deposit without sufficient approval', async () => {
            await baseToken.transfer(user.address, TEST_ACCOUNT_DEPOSIT_CAP)
            expect(
                await baseToken.allowance(user.address, collateral.address)
            ).to.eq(0)

            await expect(
                collateral.connect(user).deposit(TEST_ACCOUNT_DEPOSIT_CAP)
            ).revertedWith(
                revertReason('ERC20: transfer amount exceeds allowance')
            )
        })

        it('should not allow a non-zero deposit too small for a fee', async () => {
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                ethers.BigNumber.from(1)
            )
            expect(await collateral.balanceOf(user.address)).to.eq(0)
            expect(await baseToken.balanceOf(treasury.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(0)
            expect(await baseToken.balanceOf(user.address)).to.eq(1)

            await expect(collateral.connect(user).deposit(1)).revertedWith(
                revertReason('Deposit amount too small')
            )
        })

        it('should call depositHook with the correct parameters if a hook is configured', async () => {
            expect(await collateral.getDepositHook()).to.not.eq(AddressZero)
            /**
             * Transfer some Base Token directly to the contract to verify that the second amount passed in
             * includes the contract's latent balance
             */
            await baseToken
                .connect(deployer)
                .transfer(collateral.address, TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )

            await collateral
                .connect(user)
                .deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))

            expect(mockDepositHook.hook).to.be.calledWith(
                user.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2),
                TEST_ACCOUNT_DEPOSIT_CAP
            )
        })

        it("should not call depositHook if a hook isn't configured", async () => {
            expect(await collateral.getDepositHook()).to.eq(AddressZero)
            await collateral.connect(deployer).setDepositsAllowed(true)
            await baseToken
                .connect(deployer)
                .transfer(collateral.address, TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )

            await collateral
                .connect(user)
                .deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))

            expect(mockDepositHook.hook).to.not.have.been.called
        })

        it('should revert if the configured depositHook reverts', async () => {
            expect(await collateral.getDepositHook()).to.not.eq(AddressZero)
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            mockAccountAccessController.isAccountAllowed
                .whenCalledWith(user.address)
                .returns(false)

            await expect(
                collateral
                    .connect(user)
                    .deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            ).to.be.revertedWith(
                revertReason('Account not allowed to deposit')
            )
        })

        it('should correctly process a deposit with a non-zero initial supply', async () => {
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            await collateral
                .connect(user)
                .deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            const fee = calculateFee(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2),
                await collateral.getMintingFee()
            )
            const userCTBalanceBefore = await collateral.balanceOf(
                user.address
            )
            const totalDepositedBefore =
                await depositRecord.getGlobalDepositAmount()
            const userNetDepositsBefore = await depositRecord.getNetDeposit(
                user.address
            )
            const treasuryBTBalanceBefore = await baseToken.balanceOf(
                treasury.address
            )
            const mockStrategyBTBalanceBefore = await baseToken.balanceOf(
                mockStrategy.address
            )
            const userBTBalanceBefore = await baseToken.balanceOf(user.address)
            expect(userCTBalanceBefore).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2).sub(fee)
            )
            expect(treasuryBTBalanceBefore).to.eq(fee)
            expect(mockStrategyBTBalanceBefore).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2).sub(fee)
            )
            expect(userBTBalanceBefore).to.eq(0)
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            const expectedShares = await sharesMinted(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2).sub(fee)
            )

            await collateral
                .connect(user)
                .deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))

            expect(await collateral.balanceOf(user.address)).to.eq(
                userCTBalanceBefore.add(expectedShares)
            )
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                totalDepositedBefore.add(TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                userNetDepositsBefore.add(TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            )
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                treasuryBTBalanceBefore.add(fee)
            )
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                mockStrategyBTBalanceBefore.add(
                    TEST_ACCOUNT_DEPOSIT_CAP.div(2).sub(fee)
                )
            )
            expect(await baseToken.balanceOf(user.address)).to.eq(
                userBTBalanceBefore.add(0)
            )
        })

        it('should transfer any latent balance >0 to the strategy', async () => {
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            await baseToken.transfer(
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            expect(await collateral.balanceOf(user.address)).to.eq(0)
            expect(await baseToken.balanceOf(user.address)).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            expect(await baseToken.balanceOf(collateral.address)).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            expect(await baseToken.balanceOf(treasury.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(0)

            await collateral
                .connect(user)
                .deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))

            const fee = calculateFee(
                TEST_ACCOUNT_DEPOSIT_CAP,
                await collateral.getMintingFee()
            )
            expect(await collateral.balanceOf(user.address)).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP.sub(fee)
            )
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            expect(await baseToken.balanceOf(user.address)).to.eq(0)
            expect(await baseToken.balanceOf(collateral.address)).to.eq(0)
            expect(await baseToken.balanceOf(treasury.address)).to.eq(fee)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP.sub(fee)
            )
        })

        it('should return the amount of shares minted', async () => {
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            await collateral
                .connect(user)
                .deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            const fee = calculateFee(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2),
                await collateral.getMintingFee()
            )
            await transferAndApproveForDeposit(
                user,
                collateral.address,
                TEST_ACCOUNT_DEPOSIT_CAP.div(2)
            )
            const expectedShares = await sharesMinted(
                TEST_ACCOUNT_DEPOSIT_CAP.div(2).sub(fee)
            )

            expect(
                await collateral
                    .connect(user)
                    .callStatic.deposit(TEST_ACCOUNT_DEPOSIT_CAP.div(2))
            ).to.eq(expectedShares)
        })
    })

    describe('# initiateWithdrawal', () => {
        beforeEach(async () => {
            await setupControllerAndStrategy()
        })

        it("should not allow requesting an amount greater than the account's balance", async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            // Add 1 so that the amount being initiated exceeds the account's balance.
            const sharesToRedeem = sharesMintedForUser.add(1)
            expect(await collateral.balanceOf(user.address)).to.be.lt(
                sharesToRedeem
            )

            await expect(
                collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            ).to.be.revertedWith(revertReason('Insufficient balance'))
        })

        it('should correctly record a non-zero withdrawal request for the caller', async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = sharesMintedForUser
            expect(await collateral.balanceOf(user.address)).to.be.gte(
                sharesToRedeem
            )
            const requestOnRecordBefore =
                await collateral.getWithdrawalRequest(user.address)
            expect(requestOnRecordBefore.amount).to.eq(0)
            expect(requestOnRecordBefore.blockNumber).to.eq(0)

            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)

            const recordOnRecordAfter = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(recordOnRecordAfter.amount).to.eq(sharesToRedeem)
            expect(recordOnRecordAfter.blockNumber).to.eq(
                await getLastBlockNumber()
            )
        })

        it('should allow a withdrawal request of zero', async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            expect(await collateral.balanceOf(user.address)).to.be.gte(
                sharesMintedForUser
            )
            const requestOnRecordBefore =
                await collateral.getWithdrawalRequest(user.address)
            expect(requestOnRecordBefore.amount).to.eq(0)
            expect(requestOnRecordBefore.blockNumber).to.eq(0)

            await collateral.connect(user).initiateWithdrawal(0)

            const recordOnRecordAfter = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(recordOnRecordAfter.amount).to.eq(0)
            expect(recordOnRecordAfter.blockNumber).to.eq(
                await getLastBlockNumber()
            )
        })

        it('should update the block number for a request and keep the amount unchanged if called again with the same amount', async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const firstAmountToRequest = sharesMintedForUser
            await collateral
                .connect(user)
                .initiateWithdrawal(firstAmountToRequest)
            const requestOnRecordBefore =
                await collateral.getWithdrawalRequest(user.address)
            const secondAmountToRequest = sharesMintedForUser
            expect(secondAmountToRequest).to.be.eq(firstAmountToRequest)

            await collateral
                .connect(user)
                .initiateWithdrawal(secondAmountToRequest)

            const blockFromSecondRequest = await getLastBlockNumber()
            // Verify the block from the second withdrawal request is greater
            expect(blockFromSecondRequest).to.be.gt(
                requestOnRecordBefore.blockNumber
            )
            const requestOnRecordAfter = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecordAfter.amount).to.eq(
                requestOnRecordBefore.amount
            )
            expect(requestOnRecordAfter.blockNumber).to.eq(
                blockFromSecondRequest
            )
        })

        it('should update the block number for a request and change the amount if called again with a greater amount', async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const firstAmountToRequest = sharesMintedForUser.sub(1)
            await collateral
                .connect(user)
                .initiateWithdrawal(firstAmountToRequest)
            const requestOnRecordBefore =
                await collateral.getWithdrawalRequest(user.address)
            const secondAmountToRequest = sharesMintedForUser
            expect(secondAmountToRequest).to.be.gt(firstAmountToRequest)

            await collateral
                .connect(user)
                .initiateWithdrawal(secondAmountToRequest)

            const blockFromSecondRequest = await getLastBlockNumber()
            // Verify the block from the second withdrawal request is greater
            expect(blockFromSecondRequest).to.be.gt(
                requestOnRecordBefore.blockNumber
            )
            const requestOnRecordAfter = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecordAfter.amount).to.eq(
                requestOnRecordBefore.amount.add(1)
            )
            expect(requestOnRecordAfter.blockNumber).to.eq(
                blockFromSecondRequest
            )
        })

        it('should update the block number for a request and change the amount if called again with a lower amount', async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const firstAmountToRequest = sharesMintedForUser
            await collateral
                .connect(user)
                .initiateWithdrawal(firstAmountToRequest)
            const requestOnRecordBefore =
                await collateral.getWithdrawalRequest(user.address)
            const secondAmountToRequest = sharesMintedForUser.sub(1)
            expect(secondAmountToRequest).to.be.lt(firstAmountToRequest)

            await collateral
                .connect(user)
                .initiateWithdrawal(secondAmountToRequest)

            const blockFromSecondRequest = await getLastBlockNumber()
            // Verify the block from the second withdrawal request is greater
            expect(blockFromSecondRequest).to.be.gt(
                requestOnRecordBefore.blockNumber
            )
            const requestOnRecordAfter = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecordAfter.amount).to.eq(
                requestOnRecordBefore.amount.sub(1)
            )
            expect(requestOnRecordAfter.blockNumber).to.eq(
                blockFromSecondRequest
            )
        })
    })

    describe('# uninitiateWithdrawal', () => {
        beforeEach(async () => {
            await setupControllerAndStrategy()
        })

        it("should reset the caller's existing withdrawal request", async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = sharesMintedForUser
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            const requestOnRecordBefore =
                await collateral.getWithdrawalRequest(user.address)
            expect(requestOnRecordBefore.amount).to.eq(sharesToRedeem)
            expect(requestOnRecordBefore.blockNumber).to.eq(
                await getLastBlockNumber()
            )

            await collateral.connect(user).uninitiateWithdrawal()

            const requestOnRecordAfter = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecordAfter.amount).to.eq(0)
            expect(requestOnRecordAfter.blockNumber).to.eq(0)
        })

        it('should have no effect if the user does not have an existing request', async () => {
            const requestOnRecordBefore =
                await collateral.getWithdrawalRequest(user.address)
            expect(requestOnRecordBefore.amount).to.eq(0)
            expect(requestOnRecordBefore.blockNumber).to.eq(0)

            await collateral.connect(user).uninitiateWithdrawal()

            const requestOnRecordAfter = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecordAfter.amount).to.eq(0)
            expect(requestOnRecordAfter.blockNumber).to.eq(0)
        })
    })

    describe('# withdraw w/ delayed withdrawal expiry of zero', () => {
        beforeEach(async function () {
            await setupControllerAndStrategy()
            await collateral.setDelayedWithdrawalExpiry(0)
            await collateral.setDepositHook(mockDepositHook.address)
            if (
                this.currentTest?.title !==
                "should not call withdrawHook if a hook isn't configured"
            ) {
                await collateral.setWithdrawHook(mockWithdrawHook.address)
            }
        })

        it("should not allow withdrawals when 'withdrawalsAllowed' is set to false", async () => {
            await collateral.connect(deployer).setWithdrawalsAllowed(false)
            expect(await collateral.getWithdrawalsAllowed()).to.eq(false)
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = mintedShares
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await expect(
                collateral.connect(user).withdraw(sharesToRedeem)
            ).revertedWith(revertReason('Withdrawals not allowed'))
        })

        it('should not allow zero as a withdrawal amount when supply is 0', async () => {
            expect(await collateral.totalSupply()).to.eq(0)

            await expect(collateral.connect(user).withdraw(0)).revertedWith(
                'panic code 0x12 (Division or modulo division by zero)'
            )
        })

        it('should not allow a non-zero withdrawal amount when supply is 0', async () => {
            expect(await collateral.totalSupply()).to.eq(0)

            await expect(
                collateral.connect(user).withdraw(TEST_ACCOUNT_DEPOSIT_CAP)
            ).revertedWith(
                'panic code 0x12 (Division or modulo division by zero)'
            )
        })

        it('should not allow zero as a withdrawal amount when supply is > 0', async () => {
            await mintCollateralToWithdraw(user, TEST_ACCOUNT_DEPOSIT_CAP)
            expect(await collateral.totalSupply()).to.be.gt(0)

            await expect(collateral.connect(user).withdraw(0)).revertedWith(
                revertReason('Withdrawal amount too small')
            )
        })

        it('should not allow a non-zero withdrawal amount too small for a fee', async () => {
            await mintCollateralToWithdraw(user, TEST_ACCOUNT_DEPOSIT_CAP)

            await expect(collateral.connect(user).withdraw(1)).revertedWith(
                revertReason('Withdrawal amount too small')
            )
        })

        it('should correctly process withdrawal amount >0', async () => {
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const supplyBefore = await collateral.totalSupply()
            expect(supplyBefore).to.eq(mintedShares)
            const totalDepositsBefore =
                await depositRecord.getGlobalDepositAmount()
            const netUserDepositsBefore = await depositRecord.getNetDeposit(
                user.address
            )
            expect(await collateral.balanceOf(user.address)).to.eq(
                mintedShares
            )
            expect(await baseToken.balanceOf(user.address)).to.eq(0)
            expect(await baseToken.balanceOf(collateral.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                mintedShares
            )
            const mintingFee = TEST_ACCOUNT_DEPOSIT_CAP.sub(mintedShares)
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee
            )
            const sharesToRedeem = mintedShares.div(2)
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await collateral.connect(user).withdraw(sharesToRedeem)

            const sharesLeft = mintedShares.sub(sharesToRedeem)
            expect(await collateral.totalSupply()).to.eq(sharesLeft)
            expect(await collateral.balanceOf(user.address)).to.eq(sharesLeft)
            const virtualAfterDelay = returnFromMockAPY(
                TEST_APY,
                TEST_TIMESTAMP_DELAY,
                supplyBefore
            )
            const amountOwed = virtualAfterDelay
                .mul(sharesToRedeem)
                .div(supplyBefore)
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                totalDepositsBefore.sub(amountOwed)
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                netUserDepositsBefore.sub(amountOwed)
            )
            const redemptionFee = calculateFee(
                amountOwed,
                await collateral.getRedemptionFee()
            )
            const amountReceived = amountOwed.sub(redemptionFee)
            expect(await baseToken.balanceOf(user.address)).to.eq(
                amountReceived
            )
            expect(await baseToken.balanceOf(collateral.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                mintedShares.sub(amountOwed)
            )
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee.add(redemptionFee)
            )
        })

        it('should call withdrawHook with the correct parameters if a hook is configured', async () => {
            expect(await collateral.getWithdrawHook()).to.eq(
                mockWithdrawHook.address
            )
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const supplyBefore = await collateral.totalSupply()
            const mintingFee = TEST_ACCOUNT_DEPOSIT_CAP.sub(mintedShares)
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee
            )
            const sharesToRedeem = mintedShares.div(2)
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await collateral.connect(user).withdraw(sharesToRedeem)

            const virtualAfterDelay = returnFromMockAPY(
                TEST_APY,
                TEST_TIMESTAMP_DELAY,
                supplyBefore
            )
            const amountOwed = virtualAfterDelay
                .mul(sharesToRedeem)
                .div(supplyBefore)
            expect(mockWithdrawHook.hook).to.be.calledWith(
                user.address,
                sharesToRedeem,
                amountOwed
            )
        })

        it("should not call withdrawHook if a hook isn't configured", async () => {
            expect(await collateral.getWithdrawHook()).to.eq(AddressZero)
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = mintedShares.div(2)
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await collateral.connect(user).withdraw(sharesToRedeem)

            expect(mockWithdrawHook.hook).to.not.have.been.called
        })

        it('should return the amount of Base Token redeemed', async () => {
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const supplyBefore = await collateral.totalSupply()
            const sharesToRedeem = mintedShares.div(2)
            const timePassed = (await getLastTimestamp()) - beginning
            const virtualAfterDelay = returnFromMockAPY(
                TEST_APY,
                timePassed,
                supplyBefore
            )
            const amountOwed = virtualAfterDelay
                .mul(sharesToRedeem)
                .div(supplyBefore)
            const redemptionFee = calculateFee(
                amountOwed,
                await collateral.getRedemptionFee()
            )
            const amountReceived = amountOwed.sub(redemptionFee)

            expect(
                await collateral
                    .connect(user)
                    .callStatic.withdraw(sharesToRedeem)
            ).to.eq(amountReceived)
        })
    })

    describe('# withdraw w/ non-zero delayed withdrawal expiry', () => {
        const testWithdrawalDelayExpiry = 5
        beforeEach(async function () {
            await setupControllerAndStrategy()
            await collateral.setDelayedWithdrawalExpiry(
                testWithdrawalDelayExpiry
            )
            await collateral.setDepositHook(mockDepositHook.address)
            if (
                this.currentTest?.title !==
                "should not call withdrawHook if a hook isn't configured"
            ) {
                await collateral.setWithdrawHook(mockWithdrawHook.address)
            }
        })

        it("should not allow withdrawals when 'withdrawalsAllowed' is set to false", async () => {
            await collateral.connect(deployer).setWithdrawalsAllowed(false)
            expect(await collateral.getWithdrawalsAllowed()).to.eq(false)
            const beginning = await setupApyAndBeginning(TEST_APY)
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = sharesMintedForUser
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await expect(
                collateral.connect(user).withdraw(sharesToRedeem)
            ).revertedWith(revertReason('Withdrawals not allowed'))
        })

        it('should not allow a withdrawal if it was not initiated beforehand', async () => {
            await setupApyAndBeginning(TEST_APY)
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = sharesMintedForUser
            const requestOnRecord = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecord.amount).to.eq(0)
            expect(requestOnRecord.blockNumber).to.eq(0)

            await expect(
                collateral.connect(user).withdraw(sharesToRedeem)
            ).to.be.revertedWith(
                revertReason('Initiated amount does not match')
            )
        })

        it('should not allow zero as a withdrawal amount when supply is 0', async () => {
            await setupApyAndBeginning(TEST_APY)
            await collateral.connect(user).initiateWithdrawal(0)
            expect(await collateral.totalSupply()).to.eq(0)

            await expect(collateral.connect(user).withdraw(0)).revertedWith(
                'panic code 0x12 (Division or modulo division by zero)'
            )
        })

        it('should not allow a withdrawal when the initiated amount does not match the amount being withdrawn', async () => {
            await setupApyAndBeginning(TEST_APY)
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = sharesMintedForUser.sub(1)
            await collateral
                .connect(user)
                .initiateWithdrawal(sharesMintedForUser)
            const requestOnRecord = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecord.amount).to.not.eq(sharesToRedeem)

            await expect(
                collateral.connect(user).withdraw(sharesToRedeem)
            ).to.be.revertedWith(
                revertReason('Initiated amount does not match')
            )
        })

        it('should not allow a withdrawal to occur in the same block that it was initiated in', async () => {
            await setupApyAndBeginning(TEST_APY)
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = sharesMintedForUser
            const initiateWithdrawalCallData =
                collateral.interface.encodeFunctionData('initiateWithdrawal', [
                    sharesToRedeem,
                ])
            const withdrawCallData = collateral.interface.encodeFunctionData(
                'withdraw',
                [sharesToRedeem]
            )

            await expect(
                collateral
                    .connect(user)
                    .multicall([initiateWithdrawalCallData, withdrawCallData])
            ).to.be.revertedWith(
                revertReason('Must withdraw in a later block')
            )
        })

        it("should not allow a withdrawal to occur if the account's request has expired", async () => {
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = sharesMintedForUser
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            // Mine enough blocks to expire the withdrawal request
            const blocksUntilExpiry =
                (await collateral.getDelayedWithdrawalExpiry()).toNumber() + 1
            await mineBlocks(ethers.provider as any, blocksUntilExpiry)

            await expect(
                collateral.connect(user).withdraw(sharesToRedeem)
            ).to.be.revertedWith(revertReason('Must withdraw before expiry'))
        })

        it('should not allow zero as a withdrawal amount', async () => {
            await mintCollateralToWithdraw(user, TEST_ACCOUNT_DEPOSIT_CAP)
            await collateral.connect(user).initiateWithdrawal(0)

            await expect(collateral.connect(user).withdraw(0)).revertedWith(
                revertReason('Withdrawal amount too small')
            )
        })

        it('should not allow a withdrawal amount too small for a fee', async () => {
            await mintCollateralToWithdraw(user, TEST_ACCOUNT_DEPOSIT_CAP)
            const sharesToRedeem = 1
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)

            await expect(
                collateral.connect(user).withdraw(sharesToRedeem)
            ).revertedWith(revertReason('Withdrawal amount too small'))
        })

        it("should correctly process a withdrawal amount > 0 when the account's request expiry deadline equals the current block", async () => {
            const beginning = await setupApyAndBeginning(TEST_APY)
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const supplyBefore = await collateral.totalSupply()
            expect(supplyBefore).to.eq(sharesMintedForUser)
            const totalDepositsBefore =
                await depositRecord.getGlobalDepositAmount()
            const netUserDepositsBefore = await depositRecord.getNetDeposit(
                user.address
            )
            expect(await collateral.balanceOf(user.address)).to.eq(
                sharesMintedForUser
            )
            expect(await baseToken.balanceOf(user.address)).to.eq(0)
            expect(await baseToken.balanceOf(collateral.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                sharesMintedForUser
            )
            const mintingFee =
                TEST_ACCOUNT_DEPOSIT_CAP.sub(sharesMintedForUser)
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee
            )
            const sharesToRedeem = sharesMintedForUser.div(2)
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            const requestOnRecord = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecord.amount).to.be.eq(sharesToRedeem)
            const requestBlockExpiry =
                requestOnRecord.blockNumber.toNumber() +
                testWithdrawalDelayExpiry
            const blocksUntilExpiry =
                requestBlockExpiry - (await getLastBlockNumber())
            // Mine enough blocks to ensure the block we withdraw in is equal to the request's expiry.
            await mineBlocks(ethers.provider as any, blocksUntilExpiry - 1)
            /**
             * Set the next timestamp like the other test cases so that we have a predictable Strategy
             * yield to verify amounts against. Because this test case involves many operations after
             * the Collateral vault is initialized, the delay is recalculated again here to include
             * the time that has passed since.
             */
            const timePassedIncludingDelay =
                (await getLastTimestamp()) - beginning + TEST_TIMESTAMP_DELAY
            await setNextTimestamp(
                ethers.provider as any,
                beginning + timePassedIncludingDelay
            )

            await collateral.connect(user).withdraw(sharesToRedeem)

            // Verify that the withdrawal happened in the same block as the request's expiry.
            expect(await getLastBlockNumber()).to.eq(requestBlockExpiry)
            const sharesLeft = sharesMintedForUser.sub(sharesToRedeem)
            expect(await collateral.totalSupply()).to.eq(sharesLeft)
            expect(await collateral.balanceOf(user.address)).to.eq(sharesLeft)
            const virtualAfterDelay = returnFromMockAPY(
                TEST_APY,
                timePassedIncludingDelay,
                supplyBefore
            )
            const amountOwed = virtualAfterDelay
                .mul(sharesToRedeem)
                .div(supplyBefore)
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                totalDepositsBefore.sub(amountOwed)
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                netUserDepositsBefore.sub(amountOwed)
            )
            const redemptionFee = calculateFee(
                amountOwed,
                await collateral.getRedemptionFee()
            )
            const amountReceived = amountOwed.sub(redemptionFee)
            expect(await baseToken.balanceOf(user.address)).to.eq(
                amountReceived
            )
            expect(await baseToken.balanceOf(collateral.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                sharesMintedForUser.sub(amountOwed)
            )
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee.add(redemptionFee)
            )
        })

        it("should correctly process a withdrawal amount > 0 when the account's request expiry deadline is > than the current block", async () => {
            const beginning = await setupApyAndBeginning(TEST_APY)
            const sharesMintedForUser = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const supplyBefore = await collateral.totalSupply()
            expect(supplyBefore).to.eq(sharesMintedForUser)
            const totalDepositsBefore =
                await depositRecord.getGlobalDepositAmount()
            const netUserDepositsBefore = await depositRecord.getNetDeposit(
                user.address
            )
            expect(await collateral.balanceOf(user.address)).to.eq(
                sharesMintedForUser
            )
            expect(await baseToken.balanceOf(user.address)).to.eq(0)
            expect(await baseToken.balanceOf(collateral.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                sharesMintedForUser
            )
            const mintingFee =
                TEST_ACCOUNT_DEPOSIT_CAP.sub(sharesMintedForUser)
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee
            )
            const sharesToRedeem = sharesMintedForUser.div(2)
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            const requestOnRecord = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecord.amount).to.be.eq(sharesToRedeem)
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await collateral.connect(user).withdraw(sharesToRedeem)

            // Verify that request's expiry is greater than the block the withdrawal happened in.
            const requestBlockExpiry =
                requestOnRecord.blockNumber.toNumber() +
                testWithdrawalDelayExpiry
            expect(requestBlockExpiry).to.be.gt(await getLastBlockNumber())
            const sharesLeft = sharesMintedForUser.sub(sharesToRedeem)
            expect(await collateral.totalSupply()).to.eq(sharesLeft)
            expect(await collateral.balanceOf(user.address)).to.eq(sharesLeft)
            const virtualAfterDelay = returnFromMockAPY(
                TEST_APY,
                TEST_TIMESTAMP_DELAY,
                supplyBefore
            )
            const amountOwed = virtualAfterDelay
                .mul(sharesToRedeem)
                .div(supplyBefore)
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                totalDepositsBefore.sub(amountOwed)
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                netUserDepositsBefore.sub(amountOwed)
            )
            const redemptionFee = calculateFee(
                amountOwed,
                await collateral.getRedemptionFee()
            )
            const amountReceived = amountOwed.sub(redemptionFee)
            expect(await baseToken.balanceOf(user.address)).to.eq(
                amountReceived
            )
            expect(await baseToken.balanceOf(collateral.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                sharesMintedForUser.sub(amountOwed)
            )
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee.add(redemptionFee)
            )
        })

        it('should call withdrawHook with the correct parameters if a hook is configured', async () => {
            expect(await collateral.getWithdrawHook()).to.eq(
                mockWithdrawHook.address
            )
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const supplyBefore = await collateral.totalSupply()
            const mintingFee = TEST_ACCOUNT_DEPOSIT_CAP.sub(mintedShares)
            expect(await baseToken.balanceOf(treasury.address)).to.eq(
                mintingFee
            )
            const sharesToRedeem = mintedShares.div(2)
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            const requestOnRecord = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecord.amount).to.be.eq(sharesToRedeem)
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await collateral.connect(user).withdraw(sharesToRedeem)

            const virtualAfterDelay = returnFromMockAPY(
                TEST_APY,
                TEST_TIMESTAMP_DELAY,
                supplyBefore
            )
            const amountOwed = virtualAfterDelay
                .mul(sharesToRedeem)
                .div(supplyBefore)
            expect(mockWithdrawHook.hook).to.be.calledWith(
                user.address,
                sharesToRedeem,
                amountOwed
            )
        })

        it("should not call withdrawHook if a hook isn't configured", async () => {
            expect(await collateral.getWithdrawHook()).to.eq(AddressZero)
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const sharesToRedeem = mintedShares.div(2)
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            const requestOnRecord = await collateral.getWithdrawalRequest(
                user.address
            )
            expect(requestOnRecord.amount).to.be.eq(sharesToRedeem)
            await setNextTimestamp(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            await collateral.connect(user).withdraw(sharesToRedeem)

            expect(mockWithdrawHook.hook).to.not.have.been.called
        })

        it('should return the amount of Base Token redeemed', async () => {
            const beginning = await setupApyAndBeginning(TEST_APY)
            const mintedShares = await mintCollateralToWithdraw(
                user,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            const supplyBefore = await collateral.totalSupply()
            const sharesToRedeem = mintedShares.div(2)
            const virtualAfterDelay = returnFromMockAPY(
                TEST_APY,
                TEST_TIMESTAMP_DELAY,
                supplyBefore
            )
            const amountOwed = virtualAfterDelay
                .mul(sharesToRedeem)
                .div(supplyBefore)
            const redemptionFee = calculateFee(
                amountOwed,
                await collateral.getRedemptionFee()
            )
            const amountReceived = amountOwed.sub(redemptionFee)
            await collateral.connect(user).initiateWithdrawal(sharesToRedeem)
            /**
             * Because we are performing a static call to verify the return
             * value, we need to manually mine a block since the call to
             * withdraw will not be in a separate block.
             */
            await mineBlock(
                ethers.provider as any,
                beginning + TEST_TIMESTAMP_DELAY
            )

            expect(
                await collateral
                    .connect(user)
                    .callStatic.withdraw(sharesToRedeem)
            ).to.eq(amountReceived)
        })
    })

    describe('# setDepositsAllowed', () => {
        it('should only be callable by the owner', async () => {
            expect(await collateral.owner()).to.not.eq(user.address)

            await expect(
                collateral.connect(user).setDepositsAllowed(true)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to true', async () => {
            expect(await collateral.getDepositsAllowed()).to.eq(false)

            await collateral.connect(deployer).setDepositsAllowed(true)

            expect(await collateral.getDepositsAllowed()).to.eq(true)
        })

        it('should be settable to false', async () => {
            await collateral.connect(deployer).setDepositsAllowed(true)
            expect(await collateral.getDepositsAllowed()).to.eq(true)

            await collateral.connect(deployer).setDepositsAllowed(false)

            expect(await collateral.getDepositsAllowed()).to.eq(false)
        })

        it('should be settable to a value twice', async () => {
            expect(await collateral.getDepositsAllowed()).to.eq(false)

            await collateral.connect(deployer).setDepositsAllowed(true)

            expect(await collateral.getDepositsAllowed()).to.eq(true)

            await collateral.connect(deployer).setDepositsAllowed(true)

            expect(await collateral.getDepositsAllowed()).to.eq(true)
        })

        it('should emit a DepositsAllowedChanged event', async () => {
            await collateral.connect(deployer).setDepositsAllowed(true)

            const depositsAllowedChangedEvent =
                await getDepositsAllowedChangedEvent(collateral)
            expect(depositsAllowedChangedEvent.allowed).to.eq(true)
        })
    })

    describe('# setWithdrawalsAllowed', () => {
        it('should only be callable by the owner', async () => {
            expect(await collateral.owner()).to.not.eq(user.address)

            await expect(
                collateral.connect(user).setWithdrawalsAllowed(true)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to true', async () => {
            expect(await collateral.getWithdrawalsAllowed()).to.eq(false)

            await collateral.connect(deployer).setWithdrawalsAllowed(true)

            expect(await collateral.getWithdrawalsAllowed()).to.eq(true)
        })

        it('should be settable to false', async () => {
            await collateral.connect(deployer).setWithdrawalsAllowed(true)
            expect(await collateral.getWithdrawalsAllowed()).to.eq(true)

            await collateral.connect(deployer).setWithdrawalsAllowed(false)

            expect(await collateral.getWithdrawalsAllowed()).to.eq(false)
        })

        it('should be settable to a value twice', async () => {
            expect(await collateral.getWithdrawalsAllowed()).to.eq(false)

            await collateral.connect(deployer).setWithdrawalsAllowed(true)

            expect(await collateral.getWithdrawalsAllowed()).to.eq(true)

            await collateral.connect(deployer).setWithdrawalsAllowed(true)

            expect(await collateral.getWithdrawalsAllowed()).to.eq(true)
        })

        it('should emit a WithdrawalsAllowedChanged event', async () => {
            await collateral.connect(deployer).setWithdrawalsAllowed(true)

            const withdrawalsAllowedChangedEvent =
                await getWithdrawalsAllowedChangedEvent(collateral)
            expect(withdrawalsAllowedChangedEvent.allowed).to.eq(true)
        })
    })

    describe('# setStrategyController', () => {
        it('should only be callable by the owner', async () => {
            await expect(
                collateral.connect(user).setStrategyController(user.address)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to a non-zero address', async () => {
            expect(await collateral.getStrategyController()).to.not.eq(
                user.address
            )

            await collateral.setStrategyController(user.address)

            expect(await collateral.getStrategyController()).to.eq(
                user.address
            )
        })

        it('should be settable to the zero address', async () => {
            await collateral.setStrategyController(user.address)
            expect(await collateral.getStrategyController()).to.not.eq(
                AddressZero
            )

            await collateral.setStrategyController(AddressZero)

            expect(await collateral.getStrategyController()).to.eq(AddressZero)
        })

        it('should be settable to the same value twice', async () => {
            expect(await collateral.getStrategyController()).to.not.eq(
                user.address
            )

            await collateral.setStrategyController(user.address)

            expect(await collateral.getStrategyController()).to.eq(
                user.address
            )

            await collateral.setStrategyController(user.address)

            expect(await collateral.getStrategyController()).to.eq(
                user.address
            )
        })

        it('should emit a StrategyControllerChanged event', async () => {
            await collateral.setStrategyController(user.address)

            const strategyControllerChangedEvent =
                await getStrategyControllerChangedEvent(collateral)
            expect(strategyControllerChangedEvent.controller).to.eq(
                user.address
            )
        })
    })

    describe('# setMintingFee', () => {
        it('should only be callable by the owner', async () => {
            await expect(
                collateral.connect(user).setMintingFee(FEE_LIMIT - 1)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should not be settable beyond FEE_LIMIT', async () => {
            await expect(
                collateral.setMintingFee(FEE_LIMIT + 1)
            ).to.revertedWith(revertReason('Exceeds fee limit'))
        })

        it('should be settable to FEE_LIMIT', async () => {
            await collateral.setMintingFee(FEE_LIMIT)
            expect(await collateral.getMintingFee()).to.eq(FEE_LIMIT)
        })

        it('should be settable below FEE_LIMIT', async () => {
            await collateral.setMintingFee(FEE_LIMIT - 1)
            expect(await collateral.getMintingFee()).to.eq(FEE_LIMIT - 1)
        })

        it('should be settable to zero', async () => {
            await collateral.setMintingFee(0)
            expect(await collateral.getMintingFee()).to.eq(0)
        })

        it('should correctly set the same value twice', async () => {
            await collateral.setMintingFee(FEE_LIMIT - 1)
            expect(await collateral.getMintingFee()).to.eq(FEE_LIMIT - 1)
            await collateral.setMintingFee(FEE_LIMIT - 1)
            expect(await collateral.getMintingFee()).to.eq(FEE_LIMIT - 1)
        })

        it('should emit a MintingFeeChanged event', async () => {
            await collateral.setMintingFee(FEE_LIMIT)

            const mintingFeeChangedEvent =
                await getCollateralMintingFeeChangedEvent(collateral)
            expect(mintingFeeChangedEvent.fee).to.eq(FEE_LIMIT)
        })
    })

    describe('# setRedemptionFee', () => {
        it('should only be callable by the owner', async () => {
            await expect(
                collateral.connect(user).setRedemptionFee(FEE_LIMIT - 1)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should not be settable beyond FEE_LIMIT', async () => {
            await expect(
                collateral.setRedemptionFee(FEE_LIMIT + 1)
            ).to.revertedWith(revertReason('Exceeds fee limit'))
        })

        it('should be settable to FEE_LIMIT', async () => {
            await collateral.setRedemptionFee(FEE_LIMIT)
            expect(await collateral.getRedemptionFee()).to.eq(FEE_LIMIT)
        })

        it('should be settable below FEE_LIMIT', async () => {
            await collateral.setRedemptionFee(FEE_LIMIT - 1)
            expect(await collateral.getRedemptionFee()).to.eq(FEE_LIMIT - 1)
        })

        it('should be settable to zero', async () => {
            await collateral.setRedemptionFee(0)
            expect(await collateral.getRedemptionFee()).to.eq(0)
        })

        it('should correctly set the same value twice', async () => {
            await collateral.setRedemptionFee(FEE_LIMIT - 1)
            expect(await collateral.getRedemptionFee()).to.eq(FEE_LIMIT - 1)
            await collateral.setRedemptionFee(FEE_LIMIT - 1)
            expect(await collateral.getRedemptionFee()).to.eq(FEE_LIMIT - 1)
        })

        it('should emit a RedemptionFeeChanged event', async () => {
            await collateral.setRedemptionFee(FEE_LIMIT)

            const redemptionFeeChangedEvent =
                await getCollateralRedemptionFeeChangedEvent(collateral)
            expect(redemptionFeeChangedEvent.fee).to.eq(FEE_LIMIT)
        })
    })

    describe('# setDelayedWithdrawalExpiry', () => {
        const testWithdrawalDelayExpiry = 5
        it('should only be callable by the owner', async () => {
            await expect(
                collateral
                    .connect(user)
                    .setDelayedWithdrawalExpiry(testWithdrawalDelayExpiry)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to zero', async () => {
            expect(await collateral.getDelayedWithdrawalExpiry()).to.eq(0)

            await collateral.connect(deployer).setDelayedWithdrawalExpiry(0)

            expect(await collateral.getDelayedWithdrawalExpiry()).to.eq(0)
        })

        it('should be settable to a non-zero value', async () => {
            expect(await collateral.getDelayedWithdrawalExpiry()).to.eq(0)

            await collateral
                .connect(deployer)
                .setDelayedWithdrawalExpiry(testWithdrawalDelayExpiry)

            expect(await collateral.getDelayedWithdrawalExpiry()).to.eq(
                testWithdrawalDelayExpiry
            )
        })

        it('should correctly set the same value twice', async () => {
            expect(await collateral.getDelayedWithdrawalExpiry()).to.eq(0)
            await collateral
                .connect(deployer)
                .setDelayedWithdrawalExpiry(testWithdrawalDelayExpiry)

            await collateral
                .connect(deployer)
                .setDelayedWithdrawalExpiry(testWithdrawalDelayExpiry)

            expect(await collateral.getDelayedWithdrawalExpiry()).to.eq(
                testWithdrawalDelayExpiry
            )
        })

        it('should emit a DelayedWithdrawalExpiryChanged event', async () => {
            await collateral
                .connect(deployer)
                .setDelayedWithdrawalExpiry(testWithdrawalDelayExpiry)

            const delayedWithdrawalExpiryEvent =
                await getDelayedWithdrawalExpiryChangedEvent(collateral)
            expect(delayedWithdrawalExpiryEvent.expiry).to.eq(
                testWithdrawalDelayExpiry
            )
        })
    })

    describe('# setDepositHook', () => {
        it('should only be callable by the owner', async () => {
            expect(await collateral.owner()).to.not.eq(user.address)

            await expect(
                collateral.connect(user).setDepositHook(user.address)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to a non-zero address', async () => {
            expect(await collateral.owner()).to.eq(deployer.address)
            expect(await collateral.getDepositHook()).to.not.eq(user.address)

            await collateral.connect(deployer).setDepositHook(user.address)

            expect(await collateral.getDepositHook()).to.eq(user.address)
        })

        it('should be settable to the zero address', async () => {
            expect(await collateral.owner()).to.eq(deployer.address)
            await collateral.connect(deployer).setDepositHook(user.address)
            expect(await collateral.getDepositHook()).to.not.eq(AddressZero)

            await collateral.connect(deployer).setDepositHook(AddressZero)

            expect(await collateral.getDepositHook()).to.eq(AddressZero)
        })

        it('should emit a DepositHookChanged event', async () => {
            await collateral.connect(deployer).setDepositHook(user.address)

            const depositHookChangedEvent = await getDepositHookChangedEvent(
                collateral
            )
            expect(depositHookChangedEvent.hook).to.eq(user.address)
        })
    })

    describe('# setWithdrawHook', () => {
        it('should only be callable by the owner', async () => {
            expect(await collateral.owner()).to.not.eq(user.address)

            await expect(
                collateral.connect(user).setWithdrawHook(user.address)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to a non-zero address', async () => {
            expect(await collateral.owner()).to.eq(deployer.address)
            expect(await collateral.getWithdrawHook()).to.not.eq(user.address)

            await collateral.connect(deployer).setWithdrawHook(user.address)

            expect(await collateral.getWithdrawHook()).to.eq(user.address)
        })

        it('should be settable to the zero address', async () => {
            expect(await collateral.owner()).to.eq(deployer.address)
            await collateral.connect(deployer).setWithdrawHook(user.address)
            expect(await collateral.getWithdrawHook()).to.not.eq(AddressZero)

            await collateral.connect(deployer).setWithdrawHook(AddressZero)

            expect(await collateral.getWithdrawHook()).to.eq(AddressZero)
        })

        it('should emit a WithdrawHookChanged event', async () => {
            await collateral.connect(deployer).setWithdrawHook(user.address)

            const withdrawHookChangedEvent = await getWithdrawHookChangedEvent(
                collateral
            )
            expect(withdrawHookChangedEvent.hook).to.eq(user.address)
        })
    })
})

import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { CollateralDepositRecord } from '../typechain'
import { collateralDepositRecordFixture } from './fixtures/CollateralDepositRecordFixture'
import { parseEther } from 'ethers/lib/utils'
import {
    getAccountDepositCapChangedEvent,
    getAllowedHooksChangedEvent,
    getGlobalDepositCapChangedEvent,
} from './events'
import { revertReason } from './utils'

chai.use(solidity)

describe('=> CollateralDepositRecord', () => {
    let depositRecord: CollateralDepositRecord
    let deployer: SignerWithAddress
    let user: SignerWithAddress
    let user2: SignerWithAddress
    const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
    const TEST_ACCOUNT_DEPOSIT_CAP = parseEther('10000')
    const TEST_AMOUNT_ONE = parseEther('1')
    const TEST_AMOUNT_TWO = parseEther('2')

    beforeEach(async () => {
        ;[deployer, user, user2] = await ethers.getSigners()
        depositRecord = await collateralDepositRecordFixture(
            TEST_GLOBAL_DEPOSIT_CAP,
            TEST_ACCOUNT_DEPOSIT_CAP
        )
        await depositRecord
            .connect(deployer)
            .setAllowedHook(user.address, true)
    })

    describe('# initialize', () => {
        it('should be initialized with correct values', async () => {
            expect(await depositRecord.getGlobalDepositCap()).to.eq(
                TEST_GLOBAL_DEPOSIT_CAP
            )
            expect(await depositRecord.getAccountDepositCap()).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP
            )
        })

        it('owner should be set to deployer', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
        })
    })

    describe('# recordDeposit', () => {
        it('should only be callable by allowed contracts', async () => {
            expect(await depositRecord.isHookAllowed(user2.address)).to.eq(
                false
            )

            await expect(
                depositRecord
                    .connect(user2)
                    .recordDeposit(user.address, TEST_AMOUNT_TWO)
            ).to.be.revertedWith(revertReason('Caller not allowed'))
        })

        it("should correctly add 'finalAmount' to both deposited totals when starting from zero", async () => {
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(0)
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(0)

            await depositRecord
                .connect(user)
                .recordDeposit(user.address, TEST_AMOUNT_TWO)

            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                TEST_AMOUNT_TWO
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                TEST_AMOUNT_TWO
            )
        })

        it("should correctly add 'finalAmount' to both deposited totals when starting from a non-zero value", async () => {
            await depositRecord
                .connect(user)
                .recordDeposit(user.address, TEST_AMOUNT_TWO)
            const globalDepositsBefore =
                await depositRecord.getGlobalDepositAmount()
            const accountDepositsBefore = await depositRecord.getNetDeposit(
                user.address
            )

            await depositRecord
                .connect(user)
                .recordDeposit(user.address, TEST_AMOUNT_ONE)

            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                globalDepositsBefore.add(TEST_AMOUNT_ONE)
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                accountDepositsBefore.add(TEST_AMOUNT_ONE)
            )
        })

        it('should revert if per-account deposit cap is exceeded', async () => {
            await depositRecord
                .connect(user)
                .recordDeposit(user.address, TEST_ACCOUNT_DEPOSIT_CAP)
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                TEST_ACCOUNT_DEPOSIT_CAP
            )

            await expect(
                depositRecord.connect(user).recordDeposit(user.address, 1)
            ).to.be.revertedWith(revertReason('Account deposit cap exceeded'))
        })

        it('should revert if global deposit cap is exceeded', async () => {
            const accountsToReachCap = TEST_GLOBAL_DEPOSIT_CAP.div(
                TEST_ACCOUNT_DEPOSIT_CAP
            ).toNumber()
            const allSigners = await ethers.getSigners()
            for (let i = 0; i < accountsToReachCap; i++) {
                const currentAccountAddress = allSigners[i].address
                await depositRecord
                    .connect(user)
                    .recordDeposit(
                        currentAccountAddress,
                        TEST_ACCOUNT_DEPOSIT_CAP
                    )
                expect(
                    await depositRecord.getNetDeposit(currentAccountAddress)
                ).to.eq(TEST_ACCOUNT_DEPOSIT_CAP)
            }
            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                TEST_GLOBAL_DEPOSIT_CAP
            )
            const lastAccountAddress = allSigners[accountsToReachCap].address

            await expect(
                depositRecord
                    .connect(user)
                    .recordDeposit(lastAccountAddress, 1)
            ).to.be.revertedWith(revertReason('Global deposit cap exceeded'))
        })
    })

    describe('# recordWithdrawal', () => {
        const testDepositToWithdrawFrom = parseEther('5')
        beforeEach(async () => {
            await depositRecord
                .connect(user)
                .recordDeposit(user.address, testDepositToWithdrawFrom)
        })

        it('should only be callable by allowed contracts', async () => {
            expect(await depositRecord.isHookAllowed(user2.address)).to.eq(
                false
            )

            await expect(
                depositRecord
                    .connect(user2)
                    .recordWithdrawal(user.address, TEST_AMOUNT_TWO)
            ).to.be.revertedWith(revertReason('Caller not allowed'))
        })

        it("should correctly subtract 'finalAmount' from both deposited totals when starting from a non-zero value", async () => {
            expect(await depositRecord.getGlobalDepositAmount()).to.be.gt(0)
            expect(await depositRecord.getNetDeposit(user.address)).to.be.gt(0)
            const globalDepositsBefore =
                await depositRecord.getGlobalDepositAmount()
            const accountDepositsBefore = await depositRecord.getNetDeposit(
                user.address
            )

            await depositRecord
                .connect(user)
                .recordWithdrawal(user.address, TEST_AMOUNT_TWO)

            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                globalDepositsBefore.sub(TEST_AMOUNT_TWO)
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                accountDepositsBefore.sub(TEST_AMOUNT_TWO)
            )
        })

        it("should correctly subtract 'finalAmount' from both deposited totals when called again", async () => {
            await depositRecord
                .connect(user)
                .recordWithdrawal(user.address, TEST_AMOUNT_TWO)
            const globalDepositsBeforeSecondWithdrawal =
                await depositRecord.getGlobalDepositAmount()
            const accountDepositsBeforeSecondWithdrawal =
                await depositRecord.getNetDeposit(user.address)

            await depositRecord
                .connect(user)
                .recordWithdrawal(user.address, TEST_AMOUNT_ONE)

            expect(await depositRecord.getGlobalDepositAmount()).to.eq(
                globalDepositsBeforeSecondWithdrawal.sub(TEST_AMOUNT_ONE)
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(
                accountDepositsBeforeSecondWithdrawal.sub(TEST_AMOUNT_ONE)
            )
        })

        it('should set the deposit total to zero instead of underflowing if withdrawal amount is greater than the existing total', async () => {
            expect(await depositRecord.getGlobalDepositAmount()).to.be.eq(
                testDepositToWithdrawFrom
            )
            expect(await depositRecord.getNetDeposit(user.address)).to.be.eq(
                testDepositToWithdrawFrom
            )

            await depositRecord
                .connect(user)
                .recordWithdrawal(
                    user.address,
                    testDepositToWithdrawFrom.add(1)
                )

            expect(await depositRecord.getGlobalDepositAmount()).to.eq(0)
            expect(await depositRecord.getNetDeposit(user.address)).to.eq(0)
        })
    })

    describe('# setGlobalDepositCap', () => {
        const differentCapToTestWith = TEST_GLOBAL_DEPOSIT_CAP.add(1)
        it('should only be callable by the owner', async () => {
            expect(await depositRecord.owner()).to.not.eq(user.address)

            await expect(
                depositRecord
                    .connect(user)
                    .setGlobalDepositCap(differentCapToTestWith)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to a non-zero value', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            expect(await depositRecord.getGlobalDepositCap()).to.not.eq(
                differentCapToTestWith
            )

            await depositRecord
                .connect(deployer)
                .setGlobalDepositCap(differentCapToTestWith)

            expect(await depositRecord.getGlobalDepositCap()).to.eq(
                differentCapToTestWith
            )
        })

        it('should be settable to zero', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            expect(await depositRecord.getGlobalDepositCap()).to.not.eq(0)

            await depositRecord.connect(deployer).setGlobalDepositCap(0)

            expect(await depositRecord.getGlobalDepositCap()).to.eq(0)
        })

        it('should correctly set the same value twice', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            expect(await depositRecord.getGlobalDepositCap()).to.not.eq(
                differentCapToTestWith
            )
            await depositRecord
                .connect(deployer)
                .setGlobalDepositCap(differentCapToTestWith)
            expect(await depositRecord.getGlobalDepositCap()).to.eq(
                differentCapToTestWith
            )

            await depositRecord
                .connect(deployer)
                .setGlobalDepositCap(differentCapToTestWith)

            expect(await depositRecord.getGlobalDepositCap()).to.eq(
                differentCapToTestWith
            )
        })

        it('should emit a GlobalDepositCapChanged event', async () => {
            await depositRecord
                .connect(deployer)
                .setGlobalDepositCap(differentCapToTestWith)

            const event = await getGlobalDepositCapChangedEvent(depositRecord)
            expect(event.args.amount).to.eq(differentCapToTestWith)
        })
    })

    describe('# setAccountDepositCap', () => {
        const differentCapToTestWith = TEST_ACCOUNT_DEPOSIT_CAP.add(1)
        it('should only be callable by the owner', async () => {
            expect(await depositRecord.owner()).to.not.eq(user.address)

            await expect(
                depositRecord
                    .connect(user)
                    .setAccountDepositCap(differentCapToTestWith)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to a non-zero value', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            expect(await depositRecord.getAccountDepositCap()).to.not.eq(
                differentCapToTestWith
            )

            await depositRecord
                .connect(deployer)
                .setAccountDepositCap(differentCapToTestWith)

            expect(await depositRecord.getAccountDepositCap()).to.eq(
                differentCapToTestWith
            )
        })

        it('should be settable to zero', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            expect(await depositRecord.getAccountDepositCap()).to.not.eq(0)

            await depositRecord.connect(deployer).setAccountDepositCap(0)

            expect(await depositRecord.getAccountDepositCap()).to.eq(0)
        })

        it('should correctly set the same value twice', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            await depositRecord
                .connect(deployer)
                .setAccountDepositCap(differentCapToTestWith)
            expect(await depositRecord.getAccountDepositCap()).to.eq(
                differentCapToTestWith
            )

            await depositRecord
                .connect(deployer)
                .setAccountDepositCap(differentCapToTestWith)

            expect(await depositRecord.getAccountDepositCap()).to.eq(
                differentCapToTestWith
            )
        })

        it('should emit a AccountDepositCapChanged event', async () => {
            await depositRecord
                .connect(deployer)
                .setAccountDepositCap(differentCapToTestWith)

            const event = await getAccountDepositCapChangedEvent(depositRecord)
            expect(event.args.amount).to.eq(differentCapToTestWith)
        })
    })

    describe('# setAllowedHook', () => {
        it('should only be callable by the owner', async () => {
            expect(await depositRecord.owner()).to.not.eq(user.address)

            await expect(
                depositRecord
                    .connect(user)
                    .setAllowedHook(deployer.address, true)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be able to set the allowed status of an account to true', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                false
            )

            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, true)

            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                true
            )
        })

        it('should be able to set the allowed status of an account to false', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, true)
            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                true
            )

            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, false)

            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                false
            )
        })

        it('should be able to set the allowed status of an account to true more than once', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, true)
            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                true
            )

            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, true)

            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                true
            )
        })

        it('should be able to set the allowed status of an account to false more than once', async () => {
            expect(await depositRecord.owner()).to.eq(deployer.address)
            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, false)
            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                false
            )

            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, false)

            expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(
                false
            )
        })

        it('should emit a AllowedHooksChanged event', async () => {
            await depositRecord
                .connect(deployer)
                .setAllowedHook(deployer.address, true)

            const event = await getAllowedHooksChangedEvent(depositRecord)
            expect(event.args.hook).to.eq(deployer.address)
            expect(event.args.allowed).to.eq(true)
        })
    })
})

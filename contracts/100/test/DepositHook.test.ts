import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { DepositHook } from '../typechain'
import { depositHookFixture } from './fixtures/HookFixture'
import { smockAccountAccessControllerFixture } from './fixtures/AccountAccessControllerFixture'
import { smockCollateralDepositRecordFixture } from './fixtures/CollateralDepositRecordFixture'
import { parseEther } from 'ethers/lib/utils'
import { Contract } from 'ethers'
import { MockContract, smock } from '@defi-wonderland/smock'
import { AddressZero, revertReason } from './utils'
import { getDepositHookVaultChangedEvent } from './events'

chai.use(solidity)
chai.use(smock.matchers)

describe('=> DepositHook', () => {
    let depositHook: DepositHook
    let deployer: SignerWithAddress
    let user: SignerWithAddress
    let vault: SignerWithAddress
    let mockCollateralDepositRecord: MockContract<Contract>
    let mockAccountAccessController: MockContract<Contract>
    const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
    const TEST_ACCOUNT_DEPOSIT_CAP = parseEther('50')
    const TEST_AMOUNT_ONE = parseEther('1')
    const TEST_AMOUNT_TWO = parseEther('2')

    beforeEach(async () => {
        ;[deployer, user, vault] = await ethers.getSigners()
        mockAccountAccessController =
            await smockAccountAccessControllerFixture()
        mockCollateralDepositRecord =
            await smockCollateralDepositRecordFixture(
                TEST_GLOBAL_DEPOSIT_CAP,
                TEST_ACCOUNT_DEPOSIT_CAP
            )
        depositHook = await depositHookFixture(
            mockAccountAccessController.address,
            mockCollateralDepositRecord.address
        )
        await mockCollateralDepositRecord
            .connect(deployer)
            .setAllowedHook(depositHook.address, true)
    })

    describe('# initialize', () => {
        it('should be initialized with correct values', async () => {
            expect(await depositHook.getVault()).to.eq(AddressZero)
            expect(await depositHook.getAccountAccessController()).to.eq(
                mockAccountAccessController.address
            )
            expect(await depositHook.getDepositRecord()).to.eq(
                mockCollateralDepositRecord.address
            )
        })
    })

    describe('# hook', () => {
        beforeEach(async () => {
            await depositHook.setVault(vault.address)
        })

        it('should only usable by the vault', async () => {
            expect(await depositHook.getVault()).to.not.eq(user.address)

            await expect(
                depositHook
                    .connect(user)
                    .hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)
            ).to.revertedWith(revertReason('Caller is not the vault'))
        })

        it('should revert when an account is not allowed, but blocked', async () => {
            mockAccountAccessController.isAccountAllowed
                .whenCalledWith(user.address)
                .returns(false)
            mockAccountAccessController.isAccountBlocked
                .whenCalledWith(user.address)
                .returns(true)

            await expect(
                depositHook
                    .connect(vault)
                    .hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)
            ).to.be.revertedWith(
                revertReason('Account not allowed to deposit')
            )
        })

        it('should revert when an account is allowed and blocked', async () => {
            mockAccountAccessController.isAccountAllowed
                .whenCalledWith(user.address)
                .returns(true)
            mockAccountAccessController.isAccountBlocked
                .whenCalledWith(user.address)
                .returns(true)

            await expect(
                depositHook
                    .connect(vault)
                    .hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)
            ).to.be.revertedWith(
                revertReason('Account not allowed to deposit')
            )
        })

        it('should revert when an account is not allowed and not blocked', async () => {
            mockAccountAccessController.isAccountAllowed
                .whenCalledWith(user.address)
                .returns(false)
            mockAccountAccessController.isAccountBlocked
                .whenCalledWith(user.address)
                .returns(false)

            await expect(
                depositHook
                    .connect(vault)
                    .hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)
            ).to.be.revertedWith(
                revertReason('Account not allowed to deposit')
            )
        })

        it('should not revert when an account is allowed and not blocked', async () => {
            mockAccountAccessController.isAccountAllowed
                .whenCalledWith(user.address)
                .returns(true)
            mockAccountAccessController.isAccountBlocked
                .whenCalledWith(user.address)
                .returns(false)

            await expect(
                depositHook
                    .connect(vault)
                    .hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)
            ).not.revertedWith(revertReason('Account not allowed to deposit'))
        })

        it('should call recordDeposit with the correct parameters', async () => {
            mockAccountAccessController.isAccountAllowed
                .whenCalledWith(user.address)
                .returns(true)
            mockAccountAccessController.isAccountBlocked
                .whenCalledWith(user.address)
                .returns(false)

            await depositHook
                .connect(vault)
                .hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)

            expect(mockCollateralDepositRecord.recordDeposit).to.be.calledWith(
                user.address,
                TEST_AMOUNT_TWO
            )
            expect(
                mockCollateralDepositRecord.recordDeposit
            ).to.have.been.calledAfter(
                mockAccountAccessController.isAccountAllowed
            )
            expect(
                mockCollateralDepositRecord.recordDeposit
            ).to.have.been.calledAfter(
                mockAccountAccessController.isAccountBlocked
            )
        })
    })

    describe('# setVault', () => {
        it('should only be usable by the owner', async () => {
            await expect(
                depositHook.connect(user).setVault(vault.address)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to an address', async () => {
            expect(await depositHook.getVault()).to.eq(AddressZero)

            await depositHook.connect(deployer).setVault(vault.address)

            expect(await depositHook.getVault()).to.eq(vault.address)
        })

        it('should be settable to the zero address', async () => {
            await depositHook.connect(deployer).setVault(vault.address)
            expect(await depositHook.getVault()).to.eq(vault.address)

            await depositHook.connect(deployer).setVault(AddressZero)

            expect(await depositHook.getVault()).to.eq(AddressZero)
        })

        it('should be settable to the same value twice', async () => {
            expect(await depositHook.getVault()).to.eq(AddressZero)

            await depositHook.connect(deployer).setVault(vault.address)

            expect(await depositHook.getVault()).to.eq(vault.address)

            await depositHook.connect(deployer).setVault(vault.address)

            expect(await depositHook.getVault()).to.eq(vault.address)
        })

        it('should emit a VaultChanged event', async () => {
            await depositHook.connect(deployer).setVault(vault.address)

            const event = await getDepositHookVaultChangedEvent(depositHook)
            expect(event.vault).to.eq(vault.address)
        })
    })
})

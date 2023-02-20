import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { MockERC20 } from '../typechain/MockERC20'
import { MockStrategy } from '../typechain/MockStrategy'
import { SingleStrategyController } from '../typechain/SingleStrategyController'
import { mockERC20Fixture } from './fixtures/MockERC20Fixture'
import { mockStrategyFixture } from './fixtures/MockStrategyFixture'
import { singleStrategyControllerFixture } from './fixtures/SingleStrategyControllerFixture'
import { AddressZero } from 'ethers/node_modules/@ethersproject/constants'
import {
    getSingleStrategyControllerVaultChangedEvent,
    getStrategyMigratedEvent,
} from './events'
import { returnFromMockAPY, revertReason } from './utils'

chai.use(solidity)

describe('=> SingleStrategyController', () => {
    let strategyController: SingleStrategyController
    let mockStrategy: MockStrategy
    let collateralToken: MockERC20
    let baseToken: MockERC20
    let deployer: SignerWithAddress
    let user: SignerWithAddress
    let vault: SignerWithAddress
    let governance: SignerWithAddress
    const TEST_APY = 7
    const MOCK_COLLATERAL_SUPPLY = ethers.utils.parseEther('1000000000')
    const MOCK_BASE_TOKEN_SUPPLY = ethers.utils.parseEther('1000000000')
    const TEST_DEPOSIT_AMOUNT = ethers.utils.parseEther('1000')
    const TEST_WITHDRAWAL_AMOUNT = ethers.utils.parseEther('1000')
    beforeEach(async () => {
        ;[deployer, user, vault, governance] = await ethers.getSigners()
        collateralToken = await mockERC20Fixture(
            'prePO Collateral Token',
            'preCT'
        )
        await collateralToken.mint(deployer.address, MOCK_COLLATERAL_SUPPLY)
        baseToken = await mockERC20Fixture('Mock Base Token', 'MBT')
        await baseToken.mint(deployer.address, MOCK_BASE_TOKEN_SUPPLY)
        strategyController = await singleStrategyControllerFixture(
            baseToken.address
        )
        mockStrategy = await mockStrategyFixture(
            strategyController.address,
            baseToken.address
        )
        await mockStrategy.setVault(collateralToken.address)
        await mockStrategy.transferOwnership(governance.address)
    })

    describe('# initialize', () => {
        it('should be initialized with correct values', async () => {
            expect(await strategyController.owner()).to.eq(deployer.address)
            expect(await strategyController.getBaseToken()).to.eq(
                baseToken.address
            )
            expect(await strategyController.getStrategy()).to.eq(AddressZero)
            expect(
                await baseToken.balanceOf(strategyController.address)
            ).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(0)
        })

        it('should revert if zero address is provided as the underlying Base Token', async () => {
            const singleStrategyControllerFactory =
                await ethers.getContractFactory('SingleStrategyController')
            await expect(
                singleStrategyControllerFactory.deploy(AddressZero)
            ).to.be.revertedWith(revertReason('Zero address'))
        })
    })

    describe('# deposit', () => {
        beforeEach(async () => {
            await strategyController.migrate(mockStrategy.address)
            await strategyController.setVault(vault.address)
        })

        it('should only be callable by the vault', async () => {
            await expect(
                strategyController.connect(user).deposit(TEST_DEPOSIT_AMOUNT)
            ).revertedWith(revertReason('Caller is not the vault'))
        })

        it('should deposit to the strategy', async () => {
            await baseToken.transferOwnership(mockStrategy.address)
            await baseToken.transfer(vault.address, TEST_DEPOSIT_AMOUNT)
            await baseToken
                .connect(vault)
                .approve(strategyController.address, TEST_DEPOSIT_AMOUNT)

            await strategyController
                .connect(vault)
                .deposit(TEST_DEPOSIT_AMOUNT)

            expect(
                await baseToken.balanceOf(strategyController.address)
            ).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                TEST_DEPOSIT_AMOUNT
            )
        })

        it('should deposit the latent funds in the strategyController', async () => {
            await baseToken.transferOwnership(mockStrategy.address)
            await baseToken.transfer(vault.address, TEST_DEPOSIT_AMOUNT.div(2))
            await baseToken
                .connect(vault)
                .approve(
                    strategyController.address,
                    TEST_DEPOSIT_AMOUNT.div(2)
                )
            await baseToken.transfer(
                strategyController.address,
                TEST_DEPOSIT_AMOUNT.div(2)
            )

            await strategyController
                .connect(vault)
                .deposit(TEST_DEPOSIT_AMOUNT.div(2))

            expect(await baseToken.balanceOf(user.address)).to.eq(0)
            expect(
                await baseToken.balanceOf(strategyController.address)
            ).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                TEST_DEPOSIT_AMOUNT
            )
        })
    })

    describe('# withdraw', () => {
        beforeEach(async () => {
            await strategyController.migrate(mockStrategy.address)
            await strategyController.setVault(vault.address)
        })

        it('should only be callable by the vault', async () => {
            await expect(
                strategyController
                    .connect(user)
                    .withdraw(user.address, TEST_WITHDRAWAL_AMOUNT)
            ).revertedWith(revertReason('Caller is not the vault'))
        })

        it('should correctly withdraw funds into the specified account', async () => {
            await baseToken.transferOwnership(mockStrategy.address)
            await baseToken.transfer(
                mockStrategy.address,
                TEST_WITHDRAWAL_AMOUNT
            )

            await strategyController
                .connect(vault)
                .withdraw(user.address, TEST_WITHDRAWAL_AMOUNT)

            expect(await baseToken.balanceOf(user.address)).to.eq(
                TEST_WITHDRAWAL_AMOUNT
            )
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(0)
        })

        it('should fail upon calling mockStrategy withdraw when mockStrategy is not baseToken owner', async () => {
            await baseToken.transfer(
                mockStrategy.address,
                TEST_WITHDRAWAL_AMOUNT
            )

            await expect(
                strategyController
                    .connect(vault)
                    .withdraw(user.address, TEST_WITHDRAWAL_AMOUNT)
            ).revertedWith(revertReason('Strategy must be baseToken owner'))
        })
    })

    describe('# migrate', () => {
        let mockStrategy2: MockStrategy
        beforeEach(async function () {
            await strategyController.setVault(vault.address)
            await baseToken.transferOwnership(mockStrategy.address)
            if (
                this.currentTest?.title !==
                    'should set the strategy if one is not already set' &&
                this.currentTest?.title !==
                    'should revert if target is zero address and strategy is not already set'
            ) {
                await strategyController.migrate(mockStrategy.address)
                mockStrategy2 = await mockStrategyFixture(
                    strategyController.address,
                    baseToken.address
                )
                await mockStrategy2.setVault(collateralToken.address)
                await mockStrategy2.transferOwnership(governance.address)
            }
        })

        it('should only be usable by the owner', async () => {
            await expect(
                strategyController.connect(user).migrate(mockStrategy2.address)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should revert if target is zero address and strategy is not already set', async () => {
            expect(await strategyController.getStrategy()).to.eq(AddressZero)

            await expect(
                strategyController.migrate(AddressZero)
            ).to.be.revertedWith('ERC20: approve to the zero address')
        })

        it('should revert if target is zero address and strategy is already set', async () => {
            expect(await strategyController.getStrategy()).to.not.eq(
                AddressZero
            )

            await expect(
                strategyController.migrate(AddressZero)
            ).to.be.revertedWith('ERC20: approve to the zero address')
        })

        it('should set the strategy if one is not already set', async () => {
            expect(await strategyController.getStrategy()).to.eq(AddressZero)

            await strategyController.migrate(mockStrategy.address)

            expect(await strategyController.getStrategy()).to.eq(
                mockStrategy.address
            )
        })

        it('should set the controller to use the new strategy', async () => {
            expect(await strategyController.getStrategy()).to.eq(
                mockStrategy.address
            )
            expect(
                await baseToken.allowance(
                    strategyController.address,
                    mockStrategy2.address
                )
            ).to.eq(0)

            await strategyController.migrate(mockStrategy2.address)

            expect(await strategyController.getStrategy()).to.eq(
                mockStrategy2.address
            )
        })

        it('should give infinite approval to the new strategy', async () => {
            expect(
                await baseToken.allowance(
                    strategyController.address,
                    mockStrategy2.address
                )
            ).to.eq(0)

            await strategyController.migrate(mockStrategy2.address)

            expect(
                await baseToken.allowance(
                    strategyController.address,
                    mockStrategy2.address
                )
            ).to.eq(
                ethers.constants.MaxUint256.sub(
                    await mockStrategy.totalValue()
                )
            )
        })

        it('should set the allowance of the old strategy to 0', async () => {
            expect(
                await baseToken.allowance(
                    strategyController.address,
                    mockStrategy.address
                )
            ).to.eq(ethers.constants.MaxUint256)

            await strategyController.migrate(mockStrategy2.address)

            expect(
                await baseToken.allowance(
                    strategyController.address,
                    mockStrategy.address
                )
            ).to.eq(0)
        })

        it('should migrate funds from the old strategy to the new strategy', async () => {
            await baseToken.transfer(mockStrategy.address, TEST_DEPOSIT_AMOUNT)
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                TEST_DEPOSIT_AMOUNT
            )
            expect(await baseToken.balanceOf(mockStrategy2.address)).to.eq(0)

            await strategyController.migrate(mockStrategy2.address)

            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy2.address)).to.eq(
                await mockStrategy.totalValue()
            )
        })

        it('should send latent funds on the controller to the new strategy', async () => {
            await baseToken.transfer(mockStrategy.address, TEST_DEPOSIT_AMOUNT)
            await baseToken.transfer(
                strategyController.address,
                TEST_DEPOSIT_AMOUNT
            )
            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(
                TEST_DEPOSIT_AMOUNT
            )
            expect(await baseToken.balanceOf(mockStrategy2.address)).to.eq(0)
            expect(
                await baseToken.balanceOf(strategyController.address)
            ).to.eq(TEST_DEPOSIT_AMOUNT)

            await strategyController.migrate(mockStrategy2.address)

            expect(await baseToken.balanceOf(mockStrategy.address)).to.eq(0)
            expect(await baseToken.balanceOf(mockStrategy2.address)).to.eq(
                TEST_DEPOSIT_AMOUNT.add(await mockStrategy.totalValue())
            )
            expect(
                await baseToken.balanceOf(strategyController.address)
            ).to.eq(0)
        })

        it('should emit a StrategyMigrated event', async () => {
            await baseToken.transfer(mockStrategy.address, TEST_DEPOSIT_AMOUNT)

            await strategyController.migrate(mockStrategy2.address)

            let strategyMigratedEvent = await getStrategyMigratedEvent(
                strategyController
            )
            expect(strategyMigratedEvent.oldStrategy).to.eq(
                mockStrategy.address
            )
            expect(strategyMigratedEvent.newStrategy).to.eq(
                mockStrategy2.address
            )
            expect(strategyMigratedEvent.amount).to.eq(
                await mockStrategy.totalValue()
            )
        })
    })

    describe('# totalValue', () => {
        beforeEach(async () => {
            await strategyController.migrate(mockStrategy.address)
        })

        it('should correctly convey the total debt owed by the strategy', async () => {
            await mockStrategy.connect(governance).setApy(TEST_APY)
            let blockNumBefore = await ethers.provider.getBlockNumber()
            let blockBefore = await ethers.provider.getBlock(blockNumBefore)
            // setBeginning will increment timestamp to push totalValue to read 1 second of APY
            await mockStrategy
                .connect(governance)
                .setBeginning(blockBefore.timestamp)
            let expectedValue = returnFromMockAPY(
                TEST_APY,
                1,
                MOCK_COLLATERAL_SUPPLY
            )

            expect(await strategyController.totalValue()).to.eq(expectedValue)
        })

        it('should include latent funds within the controller', async () => {
            await baseToken.transfer(
                strategyController.address,
                TEST_WITHDRAWAL_AMOUNT
            )
            await mockStrategy.connect(governance).setApy(TEST_APY)
            let blockNumBefore = await ethers.provider.getBlockNumber()
            let blockBefore = await ethers.provider.getBlock(blockNumBefore)
            // setBeginning will increment timestamp to push totalValue to read 1 second of APY
            await mockStrategy
                .connect(governance)
                .setBeginning(blockBefore.timestamp)
            let expectedValue = returnFromMockAPY(
                TEST_APY,
                1,
                MOCK_COLLATERAL_SUPPLY
            )

            expect(await strategyController.totalValue()).to.eq(
                expectedValue.add(TEST_WITHDRAWAL_AMOUNT)
            )
        })
    })

    describe('# setVault', () => {
        it('should only be usable by the owner', async () => {
            await expect(
                strategyController.connect(user).setVault(vault.address)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to an address', async () => {
            expect(await strategyController.getVault()).to.eq(AddressZero)

            await strategyController.connect(deployer).setVault(vault.address)

            expect(await strategyController.getVault()).to.eq(vault.address)
        })

        it('should be settable to the zero address', async () => {
            await strategyController.connect(deployer).setVault(vault.address)
            expect(await strategyController.getVault()).to.eq(vault.address)

            await strategyController.connect(deployer).setVault(AddressZero)

            expect(await strategyController.getVault()).to.eq(AddressZero)
        })

        it('should be settable to the same value twice', async () => {
            expect(await strategyController.getVault()).to.eq(AddressZero)

            await strategyController.connect(deployer).setVault(vault.address)

            expect(await strategyController.getVault()).to.eq(vault.address)

            await strategyController.connect(deployer).setVault(vault.address)

            expect(await strategyController.getVault()).to.eq(vault.address)
        })

        it('should emit a VaultChanged event', async () => {
            await strategyController.connect(deployer).setVault(vault.address)

            const event = await getSingleStrategyControllerVaultChangedEvent(
                strategyController
            )
            expect(event.vault).to.eq(vault.address)
        })
    })
})

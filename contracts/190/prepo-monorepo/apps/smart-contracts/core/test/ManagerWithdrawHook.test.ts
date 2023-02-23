import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther } from 'ethers/lib/utils'
import { Contract } from 'ethers'
import { MockContract, FakeContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { managerWithdrawHookFixture } from './fixtures/HookFixture'
import { testERC20Fixture } from './fixtures/TestERC20Fixture'
import { smockDepositRecordFixture } from './fixtures/DepositRecordFixture'
import { grantAndAcceptRole, PERCENT_DENOMINATOR } from './utils'
import { fakeCollateralFixture } from './fixtures/CollateralFixture'
import { ManagerWithdrawHook, TestERC20 } from '../typechain'

chai.use(smock.matchers)

describe('=> ManagerWithdrawHook', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let managerWithdrawHook: ManagerWithdrawHook
  let baseToken: TestERC20
  let depositRecord: MockContract<Contract>
  let collateral: FakeContract<Contract>
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_USER_DEPOSIT_CAP = parseEther('50')
  const TEST_MIN_RESERVE_PERCENTAGE = 250000 // 25%

  const getSignersAndDeployHook = async (): Promise<void> => {
    ;[deployer, user] = await ethers.getSigners()
    depositRecord = await smockDepositRecordFixture(TEST_GLOBAL_DEPOSIT_CAP, TEST_USER_DEPOSIT_CAP)
    baseToken = await testERC20Fixture('USD Coin', 'USDC', 6)
    collateral = await fakeCollateralFixture()
    managerWithdrawHook = await managerWithdrawHookFixture()
  }

  const setupManagerWithdrawHook = async (): Promise<void> => {
    await getSignersAndDeployHook()
    await grantAndAcceptRole(
      managerWithdrawHook,
      deployer,
      deployer,
      await managerWithdrawHook.SET_COLLATERAL_ROLE()
    )
    await grantAndAcceptRole(
      managerWithdrawHook,
      deployer,
      deployer,
      await managerWithdrawHook.SET_DEPOSIT_RECORD_ROLE()
    )
    await grantAndAcceptRole(
      managerWithdrawHook,
      deployer,
      deployer,
      await managerWithdrawHook.SET_MIN_RESERVE_PERCENTAGE_ROLE()
    )
    await managerWithdrawHook.connect(deployer).setCollateral(collateral.address)
    await managerWithdrawHook.connect(deployer).setDepositRecord(depositRecord.address)
    await managerWithdrawHook.connect(deployer).setMinReservePercentage(TEST_MIN_RESERVE_PERCENTAGE)
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await getSignersAndDeployHook()
    })

    it('sets collateral to zero address', async () => {
      expect(await managerWithdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('sets min reserve percentage to 0', async () => {
      expect(await managerWithdrawHook.getMinReservePercentage()).to.eq(0)
    })

    it('sets percent denominator', async () => {
      expect(await managerWithdrawHook.PERCENT_DENOMINATOR()).to.eq(PERCENT_DENOMINATOR)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await managerWithdrawHook.SET_COLLATERAL_ROLE()).to.eq(
        id('ManagerWithdrawHook_setCollateral(address)')
      )
      expect(await managerWithdrawHook.SET_DEPOSIT_RECORD_ROLE()).to.eq(
        id('ManagerWithdrawHook_setDepositRecord(address)')
      )
      expect(await managerWithdrawHook.SET_MIN_RESERVE_PERCENTAGE_ROLE()).to.eq(
        id('ManagerWithdrawHook_setMinReservePercentage(uint256)')
      )
    })
  })

  describe('# setCollateral', () => {
    beforeEach(async () => {
      await getSignersAndDeployHook()
      await grantAndAcceptRole(
        managerWithdrawHook,
        deployer,
        deployer,
        await managerWithdrawHook.SET_COLLATERAL_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await managerWithdrawHook.hasRole(
          await managerWithdrawHook.SET_COLLATERAL_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        managerWithdrawHook.connect(user).setCollateral(collateral.address)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await managerWithdrawHook.SET_COLLATERAL_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      expect(await managerWithdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)

      await managerWithdrawHook.connect(deployer).setCollateral(collateral.address)

      expect(await managerWithdrawHook.getCollateral()).to.eq(collateral.address)
    })

    it('sets to zero address', async () => {
      await managerWithdrawHook.connect(deployer).setCollateral(collateral.address)
      expect(await managerWithdrawHook.getCollateral()).to.eq(collateral.address)

      await managerWithdrawHook.connect(deployer).setCollateral(ZERO_ADDRESS)

      expect(await managerWithdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await managerWithdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)

      await managerWithdrawHook.connect(deployer).setCollateral(collateral.address)

      expect(await managerWithdrawHook.getCollateral()).to.eq(collateral.address)

      await managerWithdrawHook.connect(deployer).setCollateral(collateral.address)

      expect(await managerWithdrawHook.getCollateral()).to.eq(collateral.address)
    })

    it('emits CollateralChange', async () => {
      const tx = await managerWithdrawHook.connect(deployer).setCollateral(collateral.address)

      await expect(tx).to.emit(managerWithdrawHook, 'CollateralChange').withArgs(collateral.address)
    })
  })

  describe('# setDepositRecord', () => {
    beforeEach(async () => {
      await getSignersAndDeployHook()
      await grantAndAcceptRole(
        managerWithdrawHook,
        deployer,
        deployer,
        await managerWithdrawHook.SET_DEPOSIT_RECORD_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await managerWithdrawHook.hasRole(
          await managerWithdrawHook.SET_DEPOSIT_RECORD_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        managerWithdrawHook.connect(user).setDepositRecord(depositRecord.address)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await managerWithdrawHook.SET_DEPOSIT_RECORD_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      await managerWithdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(depositRecord.address).to.not.eq(ZERO_ADDRESS)
      expect(await managerWithdrawHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await managerWithdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await managerWithdrawHook.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('sets to zero address', async () => {
      await managerWithdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)

      expect(await managerWithdrawHook.getDepositRecord()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await managerWithdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(await managerWithdrawHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await managerWithdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await managerWithdrawHook.getDepositRecord()).to.eq(depositRecord.address)

      await managerWithdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await managerWithdrawHook.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('emits DepositRecordChange', async () => {
      const tx = await managerWithdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      await expect(tx)
        .to.emit(managerWithdrawHook, 'DepositRecordChange')
        .withArgs(depositRecord.address)
    })
  })

  describe('# setMinReservePercentage', () => {
    beforeEach(async () => {
      await getSignersAndDeployHook()
      await grantAndAcceptRole(
        managerWithdrawHook,
        deployer,
        deployer,
        await managerWithdrawHook.SET_MIN_RESERVE_PERCENTAGE_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await managerWithdrawHook.hasRole(
          await managerWithdrawHook.SET_MIN_RESERVE_PERCENTAGE_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        managerWithdrawHook.connect(user).setMinReservePercentage(TEST_MIN_RESERVE_PERCENTAGE)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await managerWithdrawHook.SET_MIN_RESERVE_PERCENTAGE_ROLE()}`
      )
    })

    it('reverts if >100%', async () => {
      await expect(
        managerWithdrawHook.connect(deployer).setMinReservePercentage(PERCENT_DENOMINATOR + 1)
      ).revertedWith('>100%')
    })

    it('sets to non-zero value', async () => {
      expect(await managerWithdrawHook.getMinReservePercentage()).to.not.eq(PERCENT_DENOMINATOR - 1)

      await managerWithdrawHook.connect(deployer).setMinReservePercentage(PERCENT_DENOMINATOR - 1)

      expect(await managerWithdrawHook.getMinReservePercentage()).to.eq(PERCENT_DENOMINATOR - 1)
    })

    it('sets to 100%', async () => {
      expect(await managerWithdrawHook.getMinReservePercentage()).to.not.eq(PERCENT_DENOMINATOR)

      await managerWithdrawHook.connect(deployer).setMinReservePercentage(PERCENT_DENOMINATOR)

      expect(await managerWithdrawHook.getMinReservePercentage()).to.eq(PERCENT_DENOMINATOR)
    })

    it('sets to 0%', async () => {
      await managerWithdrawHook
        .connect(deployer)
        .setMinReservePercentage(TEST_MIN_RESERVE_PERCENTAGE)
      expect(await managerWithdrawHook.getMinReservePercentage()).to.not.eq(0)

      await managerWithdrawHook.connect(deployer).setMinReservePercentage(0)

      expect(await managerWithdrawHook.getMinReservePercentage()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await managerWithdrawHook.getMinReservePercentage()).to.not.eq(
        TEST_MIN_RESERVE_PERCENTAGE
      )

      await managerWithdrawHook
        .connect(deployer)
        .setMinReservePercentage(TEST_MIN_RESERVE_PERCENTAGE)

      expect(await managerWithdrawHook.getMinReservePercentage()).to.eq(TEST_MIN_RESERVE_PERCENTAGE)

      await managerWithdrawHook
        .connect(deployer)
        .setMinReservePercentage(TEST_MIN_RESERVE_PERCENTAGE)

      expect(await managerWithdrawHook.getMinReservePercentage()).to.eq(TEST_MIN_RESERVE_PERCENTAGE)
    })

    it('emits MinReservePercentageChange', async () => {
      const tx = await managerWithdrawHook
        .connect(deployer)
        .setMinReservePercentage(TEST_MIN_RESERVE_PERCENTAGE)

      await expect(tx)
        .to.emit(managerWithdrawHook, 'MinReservePercentageChange')
        .withArgs(TEST_MIN_RESERVE_PERCENTAGE)
    })
  })

  describe('# getMinReserve', () => {
    beforeEach(async () => {
      await setupManagerWithdrawHook()
    })

    it('reverts if deposit record not set', async () => {
      await managerWithdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)

      await expect(managerWithdrawHook.getMinReserve()).reverted
    })

    it('returns required reserve', async () => {
      depositRecord.getGlobalNetDepositAmount.returns(TEST_GLOBAL_DEPOSIT_CAP)
      const expectedRequiredReserve = TEST_GLOBAL_DEPOSIT_CAP.mul(TEST_MIN_RESERVE_PERCENTAGE).div(
        PERCENT_DENOMINATOR
      )

      expect(await managerWithdrawHook.getMinReserve()).to.be.eq(expectedRequiredReserve)
    })
  })

  describe('# hook', () => {
    const IGNORED_ARGUMENT = parseEther('69.420')
    beforeEach(async () => {
      await setupManagerWithdrawHook()
    })

    it('reverts if withdrawal brings reserve below minimum', async () => {
      depositRecord.getGlobalNetDepositAmount.returns(TEST_GLOBAL_DEPOSIT_CAP)
      const requiredReserve = TEST_GLOBAL_DEPOSIT_CAP.mul(TEST_MIN_RESERVE_PERCENTAGE).div(
        PERCENT_DENOMINATOR
      )
      collateral.getReserve.returns(requiredReserve)
      const amountToWithdraw = 1
      expect(await collateral.getReserve()).to.be.lt(requiredReserve.add(amountToWithdraw))
      expect(IGNORED_ARGUMENT).to.not.eq(amountToWithdraw)

      await expect(
        managerWithdrawHook.connect(user).hook(user.address, IGNORED_ARGUMENT, amountToWithdraw)
      ).to.revertedWith('reserve would fall below minimum')
    })

    it('allows withdrawal down to exactly reserve minimum', async () => {
      depositRecord.getGlobalNetDepositAmount.returns(TEST_GLOBAL_DEPOSIT_CAP)
      const requiredReserve = TEST_GLOBAL_DEPOSIT_CAP.mul(TEST_MIN_RESERVE_PERCENTAGE).div(
        PERCENT_DENOMINATOR
      )
      const amountToWithdraw = 1
      collateral.getReserve.returns(requiredReserve.add(amountToWithdraw))
      expect(await collateral.getReserve()).to.be.eq(requiredReserve.add(amountToWithdraw))
      expect(IGNORED_ARGUMENT).to.not.eq(amountToWithdraw)

      await managerWithdrawHook.connect(user).hook(user.address, IGNORED_ARGUMENT, amountToWithdraw)
    })

    it('allows withdrawal down to above reserve minimum', async () => {
      depositRecord.getGlobalNetDepositAmount.returns(TEST_GLOBAL_DEPOSIT_CAP)
      const requiredReserve = TEST_GLOBAL_DEPOSIT_CAP.mul(TEST_MIN_RESERVE_PERCENTAGE).div(
        PERCENT_DENOMINATOR
      )
      const amountToWithdraw = 1
      collateral.getReserve.returns(requiredReserve.add(amountToWithdraw).add(1))
      expect(await collateral.getReserve()).to.be.gt(requiredReserve.add(amountToWithdraw))
      expect(IGNORED_ARGUMENT).to.not.eq(amountToWithdraw)

      await managerWithdrawHook.connect(user).hook(user.address, IGNORED_ARGUMENT, amountToWithdraw)
    })

    it('allows withdrawal if reserve = global net deposit amount', async () => {
      depositRecord.getGlobalNetDepositAmount.returns(TEST_GLOBAL_DEPOSIT_CAP)
      collateral.getReserve.returns(TEST_GLOBAL_DEPOSIT_CAP)

      const amountToWithdraw = 1
      await managerWithdrawHook.connect(user).hook(user.address, IGNORED_ARGUMENT, amountToWithdraw)
    })

    it('allows withdrawal if reserve > global net deposit amount', async () => {
      depositRecord.getGlobalNetDepositAmount.returns(TEST_GLOBAL_DEPOSIT_CAP)
      collateral.getReserve.returns(TEST_GLOBAL_DEPOSIT_CAP.add(1))

      const amountToWithdraw = 1
      await managerWithdrawHook.connect(user).hook(user.address, IGNORED_ARGUMENT, amountToWithdraw)
    })
  })
})

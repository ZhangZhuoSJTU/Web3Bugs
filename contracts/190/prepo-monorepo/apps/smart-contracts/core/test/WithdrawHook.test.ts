import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther } from 'ethers/lib/utils'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { Contract } from 'ethers'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { withdrawHookFixture } from './fixtures/HookFixture'
import { smockDepositRecordFixture } from './fixtures/DepositRecordFixture'
import { getSignerForContract, grantAndAcceptRole, batchGrantAndAcceptRoles } from './utils'
import { smockTestERC20Fixture } from './fixtures/TestERC20Fixture'
import { fakeCollateralFixture } from './fixtures/CollateralFixture'
import { smockTokenSenderFixture } from './fixtures/TokenSenderFixture'
import { WithdrawHook } from '../typechain'

chai.use(smock.matchers)

const { getLastTimestamp, setNextTimestamp } = utils

describe('=> WithdrawHook', () => {
  let withdrawHook: WithdrawHook
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let collateral: FakeContract<Contract>
  let collateralSigner: SignerWithAddress
  let depositRecord: MockContract<Contract>
  let treasury: SignerWithAddress
  let testToken: MockContract<Contract>
  let tokenSender: FakeContract<Contract>
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_ACCOUNT_DEPOSIT_CAP = parseEther('50')
  const TEST_AMOUNT_BEFORE_FEE = parseEther('1.01')
  const TEST_AMOUNT_AFTER_FEE = parseEther('1')
  const TEST_GLOBAL_PERIOD_LENGTH = 20
  const TEST_USER_PERIOD_LENGTH = 10
  const TEST_GLOBAL_WITHDRAW_LIMIT = TEST_AMOUNT_BEFORE_FEE.mul(3)
  const TEST_USER_WITHDRAW_LIMIT = TEST_AMOUNT_BEFORE_FEE.mul(2)

  beforeEach(async () => {
    ;[deployer, user, treasury] = await ethers.getSigners()
    depositRecord = await smockDepositRecordFixture(
      TEST_GLOBAL_DEPOSIT_CAP,
      TEST_ACCOUNT_DEPOSIT_CAP
    )
    withdrawHook = await withdrawHookFixture()
    testToken = await smockTestERC20Fixture('Test Token', 'TEST', 18)
    collateral = await fakeCollateralFixture()
    collateral.getBaseToken.returns(testToken.address)
    collateralSigner = await getSignerForContract(collateral)
    tokenSender = await smockTokenSenderFixture(testToken.address)
    await batchGrantAndAcceptRoles(withdrawHook, deployer, deployer, [
      withdrawHook.SET_COLLATERAL_ROLE(),
      withdrawHook.SET_DEPOSIT_RECORD_ROLE(),
      withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE(),
      withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE(),
      withdrawHook.SET_USER_PERIOD_LENGTH_ROLE(),
      withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
      withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
      withdrawHook.SET_TREASURY_ROLE(),
      withdrawHook.SET_TOKEN_SENDER_ROLE(),
    ])
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_ALLOWED_HOOK_ROLE()
    )
    await depositRecord.connect(deployer).setAllowedHook(user.address, true)
    await depositRecord.connect(deployer).setAllowedHook(withdrawHook.address, true)
  })

  describe('initial state', () => {
    it('sets collateral to zero address', async () => {
      expect(await withdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('sets last global period reset to 0', async () => {
      expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(0)
    })

    it('sets last user period reset to 0', async () => {
      expect(await withdrawHook.getLastUserPeriodReset()).to.eq(0)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await withdrawHook.SET_TREASURY_ROLE()).to.eq(id('WithdrawHook_setTreasury(address)'))
      expect(await withdrawHook.SET_TOKEN_SENDER_ROLE()).to.eq(
        id('WithdrawHook_setTokenSender(ITokenSender)')
      )
      expect(await withdrawHook.SET_COLLATERAL_ROLE()).to.eq(
        id('WithdrawHook_setCollateral(address)')
      )
      expect(await withdrawHook.SET_DEPOSIT_RECORD_ROLE()).to.eq(
        id('WithdrawHook_setDepositRecord(address)')
      )
      expect(await withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE()).to.eq(
        id('WithdrawHook_setWithdrawalsAllowed(bool)')
      )
      expect(await withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE()).to.eq(
        id('WithdrawHook_setGlobalPeriodLength(uint256)')
      )
      expect(await withdrawHook.SET_USER_PERIOD_LENGTH_ROLE()).to.eq(
        id('WithdrawHook_setUserPeriodLength(uint256)')
      )
      expect(await withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE()).to.eq(
        id('WithdrawHook_setGlobalWithdrawLimitPerPeriod(uint256)')
      )
      expect(await withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE()).to.eq(
        id('WithdrawHook_setUserWithdrawLimitPerPeriod(uint256)')
      )
    })
  })

  describe('# hook', () => {
    /**
     * Tests below use different values for TEST_AMOUNT_BEFORE_FEE and
     * TEST_AMOUNT_AFTER_FEE to ensure TEST_AMOUNT_AFTER_FEE is ignored.
     */
    beforeEach(async () => {
      await withdrawHook.setCollateral(collateral.address)
      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)
      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)
      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)
      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)
      await withdrawHook.connect(deployer).setTreasury(treasury.address)
      await withdrawHook.connect(deployer).setTokenSender(tokenSender.address)
      await testToken.connect(deployer).mint(collateral.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken.connect(deployer).mint(user.address, TEST_GLOBAL_DEPOSIT_CAP)
      await testToken
        .connect(collateralSigner)
        .approve(withdrawHook.address, ethers.constants.MaxUint256)
      tokenSender.send.returns()
    })

    it('only callable by collateral', async () => {
      expect(await withdrawHook.getCollateral()).to.not.eq(user.address)

      await expect(
        withdrawHook.connect(user).hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
      ).to.revertedWith('msg.sender != collateral')
    })

    it('calls recordWithdrawal() with correct parameters', async () => {
      await withdrawHook
        .connect(collateralSigner)
        .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

      expect(depositRecord.recordWithdrawal).to.be.calledWith(TEST_AMOUNT_BEFORE_FEE)
    })

    it("doesn't revert if withdrawing 0", async () => {
      await withdrawHook.connect(collateralSigner).hook(user.address, 0, 0)
    })

    describe('fee reimbursement', () => {
      it('transfers fee to treasury if fee > 0', async () => {
        expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(testToken.transferFrom).to.be.calledWith(collateral.address, treasury.address, fee)
      })

      it('calls tokenSender.send() if fee > 0', async () => {
        expect(TEST_AMOUNT_BEFORE_FEE).to.not.eq(TEST_AMOUNT_AFTER_FEE)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const fee = TEST_AMOUNT_BEFORE_FEE.sub(TEST_AMOUNT_AFTER_FEE)
        expect(tokenSender.send).to.be.calledWith(user.address, fee)
      })

      it("doesn't transfer fee to treasury if fee = 0", async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

        expect(testToken.transferFrom).to.not.be.called
      })

      it("doesn't call tokenSender.send() if fee = 0", async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_BEFORE_FEE)

        expect(tokenSender.send).to.not.be.called
      })
    })

    describe('global withdraw limit testing', () => {
      it('sets last global reset to current time if 0', async () => {
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(0)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(
          await getLastTimestamp(ethers.provider)
        )
      })

      it('sets last global reset to current time if global period passed', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const currentResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(currentResetTimestamp).to.be.gt(previousResetTimestamp)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(currentResetTimestamp)
      })

      it('sets global amount withdrawn to current amount being withdrawn if global period passed', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const differentAmountToWithdraw = 1
        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.not.eq(
          differentAmountToWithdraw
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, differentAmountToWithdraw, differentAmountToWithdraw)

        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          differentAmountToWithdraw
        )
      })

      it("doesn't update last global reset if global period exactly reached", async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to amount withdrawn if global period exactly reached', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousGlobalAmountWithdrawn =
          await withdrawHook.getGlobalAmountWithdrawnThisPeriod()
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          previousGlobalAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it("doesn't update last global reset if global period not reached", async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastGlobalPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to global amount withdrawn if global period not reached', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousGlobalAmountWithdrawn =
          await withdrawHook.getGlobalAmountWithdrawnThisPeriod()
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          previousGlobalAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it('adds to global amount withdrawn if global withdraw limit exactly reached for period', async () => {
        // Using deployer and user since we need 2 users to meet global cap
        await withdrawHook
          .connect(collateralSigner)
          .hook(deployer.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)
        const globalWithdrawnBefore = await withdrawHook.getGlobalAmountWithdrawnThisPeriod()
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )
        const amountToReachGlobalLimit = TEST_GLOBAL_WITHDRAW_LIMIT.sub(globalWithdrawnBefore)

        await expect(
          withdrawHook
            .connect(collateralSigner)
            .hook(user.address, amountToReachGlobalLimit, amountToReachGlobalLimit)
        ).to.not.reverted
      })

      it('reverts if global withdraw limit exceeded for period', async () => {
        // Using deployer and user since we need 2 users to exceed global cap
        await withdrawHook
          .connect(collateralSigner)
          .hook(deployer.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        const amountToReachGlobalLimit = TEST_GLOBAL_WITHDRAW_LIMIT.sub(TEST_USER_WITHDRAW_LIMIT)
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, amountToReachGlobalLimit, amountToReachGlobalLimit)
        expect(await withdrawHook.getGlobalAmountWithdrawnThisPeriod()).to.eq(
          TEST_GLOBAL_WITHDRAW_LIMIT
        )
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )

        await expect(
          withdrawHook.connect(collateralSigner).hook(user.address, 1, 1)
        ).to.revertedWith('global withdraw limit exceeded')
      })
    })

    describe('user withdraw limit testing', () => {
      it('sets last user reset to current time if 0', async () => {
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(0)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(
          await getLastTimestamp(ethers.provider)
        )
      })

      it('sets last user reset to current time if user period passed', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        const currentResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(currentResetTimestamp)
      })

      it('sets user amount withdrawn to current amount being withdrawn if user period passed', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        /**
         * Using a different withdrawal amount to prevent a false positive if
         * the last amount withdrawn doesn't change. Using 2 as a value since
         * we want to show that `amountBeforeFee` is used rather than
         * `amountAfterFee` and 1 is already the smallest non-zero value.
         */
        const differentAmountToWithdraw = 2
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.not.eq(
          differentAmountToWithdraw
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH + 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, differentAmountToWithdraw, differentAmountToWithdraw - 1)

        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          differentAmountToWithdraw
        )
      })

      it("doesn't update last user reset if user period exactly reached", async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_USER_PERIOD_LENGTH)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to amount withdrawn if user period exactly reached', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousUserAmountWithdrawn = await withdrawHook.getAmountWithdrawnThisPeriod(
          user.address
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(ethers.provider, previousResetTimestamp + TEST_USER_PERIOD_LENGTH)

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          previousUserAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it("doesn't update last user reset if user period not reached", async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getLastUserPeriodReset()).to.eq(previousResetTimestamp)
      })

      it('adds to user amount withdrawn if user period not reached', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)
        const previousUserAmountWithdrawn = await withdrawHook.getAmountWithdrawnThisPeriod(
          user.address
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_AMOUNT_BEFORE_FEE, TEST_AMOUNT_AFTER_FEE)

        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          previousUserAmountWithdrawn.add(TEST_AMOUNT_BEFORE_FEE)
        )
      })

      it('reverts if user withdraw limit exceeded for period', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          TEST_USER_WITHDRAW_LIMIT
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await expect(
          withdrawHook.connect(collateralSigner).hook(user.address, 1, 1)
        ).to.revertedWith('user withdraw limit exceeded')
      })

      it('adds to user amount withdrawn if user withdraw limit exactly reached for period', async () => {
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_GLOBAL_PERIOD_LENGTH - 1
        )
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_USER_WITHDRAW_LIMIT.sub(1), TEST_USER_WITHDRAW_LIMIT.sub(1))

        await expect(withdrawHook.connect(collateralSigner).hook(user.address, 1, 1)).to.not
          .reverted
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          TEST_USER_WITHDRAW_LIMIT
        )
      })

      it('reverts if user withdraw limit exceeded for period', async () => {
        await withdrawHook
          .connect(collateralSigner)
          .hook(user.address, TEST_USER_WITHDRAW_LIMIT, TEST_USER_WITHDRAW_LIMIT)
        expect(await withdrawHook.getAmountWithdrawnThisPeriod(user.address)).to.eq(
          TEST_USER_WITHDRAW_LIMIT
        )
        const previousResetTimestamp = await getLastTimestamp(ethers.provider)
        await setNextTimestamp(
          ethers.provider,
          previousResetTimestamp + TEST_USER_PERIOD_LENGTH - 1
        )

        await expect(
          withdrawHook.connect(collateralSigner).hook(user.address, 1, 1)
        ).to.revertedWith('user withdraw limit exceeded')
      })
    })
  })

  describe('# setCollateral', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_COLLATERAL_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setCollateral(collateral.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_COLLATERAL_ROLE()}`
      )
    })

    it('should be settable to an address', async () => {
      expect(await withdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)

      await withdrawHook.connect(deployer).setCollateral(collateral.address)

      expect(await withdrawHook.getCollateral()).to.eq(collateral.address)
    })

    it('should be settable to the zero address', async () => {
      await withdrawHook.connect(deployer).setCollateral(collateral.address)
      expect(await withdrawHook.getCollateral()).to.eq(collateral.address)

      await withdrawHook.connect(deployer).setCollateral(ZERO_ADDRESS)

      expect(await withdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)
    })

    it('should be settable to the same value twice', async () => {
      expect(await withdrawHook.getCollateral()).to.eq(ZERO_ADDRESS)

      await withdrawHook.connect(deployer).setCollateral(collateral.address)

      expect(await withdrawHook.getCollateral()).to.eq(collateral.address)

      await withdrawHook.connect(deployer).setCollateral(collateral.address)

      expect(await withdrawHook.getCollateral()).to.eq(collateral.address)
    })

    it('emits CollateralChange', async () => {
      const tx = await withdrawHook.connect(deployer).setCollateral(collateral.address)

      await expect(tx).to.emit(withdrawHook, 'CollateralChange').withArgs(collateral.address)
    })
  })

  describe('# setDepositRecord', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_DEPOSIT_RECORD_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setDepositRecord(depositRecord.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_DEPOSIT_RECORD_ROLE()}`
      )
    })

    it('sets to non-zero address', async () => {
      await withdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(depositRecord.address).to.not.eq(ZERO_ADDRESS)
      expect(await withdrawHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await withdrawHook.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('sets to zero address', async () => {
      await withdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)

      expect(await withdrawHook.getDepositRecord()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await withdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(await withdrawHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await withdrawHook.getDepositRecord()).to.eq(depositRecord.address)

      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await withdrawHook.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('emits DepositRecordChange', async () => {
      const tx = await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      await expect(tx).to.emit(withdrawHook, 'DepositRecordChange').withArgs(depositRecord.address)
    })
  })

  describe('# setWithdrawalsAllowed', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setWithdrawalsAllowed(true)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_WITHDRAWALS_ALLOWED_ROLE()}`
      )
    })

    it('sets to false', async () => {
      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)
      expect(await withdrawHook.withdrawalsAllowed()).to.not.eq(false)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(false)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(false)
    })

    it('sets to true', async () => {
      expect(await withdrawHook.withdrawalsAllowed()).to.not.eq(true)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(true)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.withdrawalsAllowed()).to.not.eq(true)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(true)

      await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      expect(await withdrawHook.withdrawalsAllowed()).to.eq(true)
    })

    it('emits WithdrawalsAllowedChange', async () => {
      const tx = await withdrawHook.connect(deployer).setWithdrawalsAllowed(true)

      await expect(tx).to.emit(withdrawHook, 'WithdrawalsAllowedChange').withArgs(true)
    })
  })

  describe('# setGlobalPeriodLength', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_GLOBAL_PERIOD_LENGTH_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)
      expect(await withdrawHook.getGlobalPeriodLength()).to.not.eq(0)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(0)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getGlobalPeriodLength()).to.not.eq(TEST_GLOBAL_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(TEST_GLOBAL_PERIOD_LENGTH)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getGlobalPeriodLength()).to.not.eq(TEST_GLOBAL_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(TEST_GLOBAL_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      expect(await withdrawHook.getGlobalPeriodLength()).to.eq(TEST_GLOBAL_PERIOD_LENGTH)
    })

    it('emits GlobalPeriodLengthChange', async () => {
      const tx = await withdrawHook
        .connect(deployer)
        .setGlobalPeriodLength(TEST_GLOBAL_PERIOD_LENGTH)

      await expect(tx)
        .to.emit(withdrawHook, 'GlobalPeriodLengthChange')
        .withArgs(TEST_GLOBAL_PERIOD_LENGTH)
    })
  })

  describe('# setUserPeriodLength', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_USER_PERIOD_LENGTH_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_USER_PERIOD_LENGTH_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)
      expect(await withdrawHook.getUserPeriodLength()).to.not.eq(0)

      await withdrawHook.connect(deployer).setUserPeriodLength(0)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getUserPeriodLength()).to.not.eq(TEST_USER_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(TEST_USER_PERIOD_LENGTH)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getUserPeriodLength()).to.not.eq(TEST_USER_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(TEST_USER_PERIOD_LENGTH)

      await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      expect(await withdrawHook.getUserPeriodLength()).to.eq(TEST_USER_PERIOD_LENGTH)
    })

    it('emits UserPeriodLengthChange', async () => {
      const tx = await withdrawHook.connect(deployer).setUserPeriodLength(TEST_USER_PERIOD_LENGTH)

      await expect(tx)
        .to.emit(withdrawHook, 'UserPeriodLengthChange')
        .withArgs(TEST_USER_PERIOD_LENGTH)
    })
  })

  describe('# setGlobalWithdrawLimitPerPeriod', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(
          await withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.not.eq(0)

      await withdrawHook.connect(deployer).setGlobalWithdrawLimitPerPeriod(0)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.not.eq(
        TEST_GLOBAL_WITHDRAW_LIMIT
      )

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(TEST_GLOBAL_WITHDRAW_LIMIT)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.not.eq(
        TEST_GLOBAL_WITHDRAW_LIMIT
      )

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(TEST_GLOBAL_WITHDRAW_LIMIT)

      await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      expect(await withdrawHook.getGlobalWithdrawLimitPerPeriod()).to.eq(TEST_GLOBAL_WITHDRAW_LIMIT)
    })

    it('emits GlobalWithdrawLimitPerPeriodChange', async () => {
      const tx = await withdrawHook
        .connect(deployer)
        .setGlobalWithdrawLimitPerPeriod(TEST_GLOBAL_WITHDRAW_LIMIT)

      await expect(tx)
        .to.emit(withdrawHook, 'GlobalWithdrawLimitPerPeriodChange')
        .withArgs(TEST_GLOBAL_WITHDRAW_LIMIT)
    })
  })

  describe('# setUserWithdrawLimitPerPeriod', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(
          await withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        withdrawHook.connect(user).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE()}`
      )
    })

    it('sets to zero', async () => {
      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)
      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.not.eq(0)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(0)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(0)
    })

    it('sets to non-zero value', async () => {
      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.not.eq(TEST_USER_WITHDRAW_LIMIT)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(TEST_USER_WITHDRAW_LIMIT)
    })

    it('is idempotent', async () => {
      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.not.eq(TEST_USER_WITHDRAW_LIMIT)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(TEST_USER_WITHDRAW_LIMIT)

      await withdrawHook.connect(deployer).setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      expect(await withdrawHook.getUserWithdrawLimitPerPeriod()).to.eq(TEST_USER_WITHDRAW_LIMIT)
    })

    it('emits UserWithdrawLimitPerPeriodChange', async () => {
      const tx = await withdrawHook
        .connect(deployer)
        .setUserWithdrawLimitPerPeriod(TEST_USER_WITHDRAW_LIMIT)

      await expect(tx)
        .to.emit(withdrawHook, 'UserWithdrawLimitPerPeriodChange')
        .withArgs(TEST_USER_WITHDRAW_LIMIT)
    })
  })

  describe('# setTreasury', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TREASURY_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setTreasury(treasury.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_TREASURY_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TREASURY_ROLE(), deployer.address)
      ).to.eq(true)

      await withdrawHook.connect(deployer).setTreasury(treasury.address)
    })
  })

  describe('# setTokenSender', () => {
    it('reverts if not role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TOKEN_SENDER_ROLE(), user.address)
      ).to.eq(false)

      await expect(withdrawHook.connect(user).setTokenSender(tokenSender.address)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await withdrawHook.SET_TOKEN_SENDER_ROLE()}`
      )
    })

    it('succeeds if role holder', async () => {
      expect(
        await withdrawHook.hasRole(await withdrawHook.SET_TOKEN_SENDER_ROLE(), deployer.address)
      ).to.eq(true)

      await withdrawHook.connect(deployer).setTokenSender(tokenSender.address)
    })
  })
})

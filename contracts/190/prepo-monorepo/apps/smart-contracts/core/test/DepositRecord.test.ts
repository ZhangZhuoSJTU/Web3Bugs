import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther } from 'ethers/lib/utils'
import { DEFAULT_ADMIN_ROLE } from 'prepo-constants'
import { depositRecordFixture } from './fixtures/DepositRecordFixture'
import { grantAndAcceptRole } from './utils'
import { DepositRecord } from '../typechain'

describe('=> DepositRecord', () => {
  let depositRecord: DepositRecord
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_USER_DEPOSIT_CAP = parseEther('10000')
  const TEST_AMOUNT_ONE = parseEther('1')
  const TEST_AMOUNT_TWO = parseEther('2')

  const getSignersAndDeployRecord = async (): Promise<void> => {
    ;[deployer, user, user2] = await ethers.getSigners()
    depositRecord = await depositRecordFixture(TEST_GLOBAL_DEPOSIT_CAP, TEST_USER_DEPOSIT_CAP)
  }

  const setupDepositRecord = async (): Promise<void> => {
    await getSignersAndDeployRecord()
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()
    )
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()
    )
    await grantAndAcceptRole(
      depositRecord,
      deployer,
      deployer,
      await depositRecord.SET_ALLOWED_HOOK_ROLE()
    )
    await depositRecord.connect(deployer).setAllowedHook(user.address, true)
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await getSignersAndDeployRecord()
    })

    it('sets global deposit cap from constructor', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(TEST_GLOBAL_DEPOSIT_CAP)
    })

    it('sets user deposit cap from constructor', async () => {
      expect(await depositRecord.getUserDepositCap()).to.eq(TEST_USER_DEPOSIT_CAP)
    })

    it('sets DEFAULT_ADMIN_ROLE holder to deployer', async () => {
      expect(await depositRecord.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(true)
    })

    it('sets role constants to the correct hash', async () => {
      expect(await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()).to.eq(
        id('DepositRecord_setGlobalNetDepositCap(uint256)')
      )
      expect(await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()).to.eq(
        id('DepositRecord_setUserDepositCap(uint256)')
      )
      expect(await depositRecord.SET_ALLOWED_HOOK_ROLE()).to.eq(
        id('DepositRecord_setAllowedHook(address)')
      )
    })
  })

  describe('# recordDeposit', () => {
    beforeEach(async () => {
      await setupDepositRecord()
    })

    it('should only be callable by allowed contracts', async () => {
      expect(await depositRecord.isHookAllowed(user2.address)).to.eq(false)

      await expect(
        depositRecord.connect(user2).recordDeposit(user.address, TEST_AMOUNT_TWO)
      ).to.be.revertedWith('msg.sender != allowed hook')
    })

    it("should correctly add 'amount' to both deposited totals when starting from zero", async () => {
      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(0)
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(0)

      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(TEST_AMOUNT_TWO)
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(TEST_AMOUNT_TWO)
    })

    it("should correctly add 'amount' to both deposited totals when starting from a non-zero value", async () => {
      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_TWO)
      const globalDepositsBefore = await depositRecord.getGlobalNetDepositAmount()
      const accountDepositsBefore = await depositRecord.getUserDepositAmount(user.address)

      await depositRecord.connect(user).recordDeposit(user.address, TEST_AMOUNT_ONE)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositsBefore.add(TEST_AMOUNT_ONE)
      )
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(
        accountDepositsBefore.add(TEST_AMOUNT_ONE)
      )
    })

    it('should revert if per-account deposit cap is exceeded', async () => {
      await depositRecord.connect(user).recordDeposit(user.address, TEST_USER_DEPOSIT_CAP)
      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(TEST_USER_DEPOSIT_CAP)
      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(TEST_USER_DEPOSIT_CAP)

      await expect(depositRecord.connect(user).recordDeposit(user.address, 1)).to.be.revertedWith(
        'User deposit cap exceeded'
      )
    })

    it('should revert if global deposit cap is exceeded', async () => {
      const accountsToReachCap = TEST_GLOBAL_DEPOSIT_CAP.div(TEST_USER_DEPOSIT_CAP).toNumber()
      const allSigners = await ethers.getSigners()
      for (let i = 0; i < accountsToReachCap; i++) {
        const currentAccountAddress = allSigners[i].address
        // eslint-disable-next-line no-await-in-loop
        await depositRecord
          .connect(user)
          .recordDeposit(currentAccountAddress, TEST_USER_DEPOSIT_CAP)
        // eslint-disable-next-line no-await-in-loop
        expect(await depositRecord.getUserDepositAmount(currentAccountAddress)).to.eq(
          TEST_USER_DEPOSIT_CAP
        )
      }
      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(TEST_GLOBAL_DEPOSIT_CAP)
      const lastAccountAddress = allSigners[accountsToReachCap].address

      await expect(
        depositRecord.connect(user).recordDeposit(lastAccountAddress, 1)
      ).to.be.revertedWith('Global deposit cap exceeded')
    })
  })

  describe('# recordWithdrawal', () => {
    beforeEach(async () => {
      await setupDepositRecord()
      await depositRecord
        .connect(user)
        .recordDeposit(user.address, TEST_AMOUNT_ONE.add(TEST_AMOUNT_TWO))
    })

    it('reverts if caller not allowed', async () => {
      expect(await depositRecord.isHookAllowed(user2.address)).to.eq(false)

      await expect(
        depositRecord.connect(user2).recordWithdrawal(TEST_AMOUNT_TWO)
      ).to.be.revertedWith('msg.sender != allowed hook')
    })

    it('subtracts from global deposits if withdrawal > 0 and global deposits > 0', async () => {
      const globalDepositsBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositsBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositsBefore.sub(TEST_AMOUNT_TWO)
      )
    })

    it('leaves user deposits unchanged if withdrawal > 0 and user deposit > 0', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('leaves global deposits unchanged if withdrawal = 0 and global deposits > 0', async () => {
      const globalDepositsBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositsBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(globalDepositsBefore)
    })

    it('leaves user deposits unchanged if withdrawal = 0 and user deposit > 0', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('leaves global deposits unchanged if withdrawal = 0 and global deposits = 0', async () => {
      await depositRecord
        .connect(user)
        .recordWithdrawal(await depositRecord.getGlobalNetDepositAmount())
      const globalDepositsBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositsBefore).to.be.eq(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(globalDepositsBefore)
    })

    it('leaves user deposits unchanged if withdrawal = 0 and user deposit = 0', async () => {
      await depositRecord
        .connect(user)
        .recordWithdrawal(await depositRecord.getUserDepositAmount(user.address))
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(0)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('sets global deposits to 0 if withdrawal > global deposits', async () => {
      const globalDepositsBefore = await depositRecord.getGlobalNetDepositAmount()
      expect(globalDepositsBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(globalDepositsBefore.add(1))

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(0)
    })

    it('leaves user deposits unchanged if withdrawal > global deposits', async () => {
      const userDepositBefore = await depositRecord.getUserDepositAmount(user.address)
      expect(userDepositBefore).to.be.gt(0)

      await depositRecord.connect(user).recordWithdrawal(userDepositBefore.add(1))

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(userDepositBefore)
    })

    it('subtracts from global deposits if called again', async () => {
      await depositRecord.connect(user).recordWithdrawal(1)
      const globalDepositsBeforeSecondWithdrawal = await depositRecord.getGlobalNetDepositAmount()

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalNetDepositAmount()).to.eq(
        globalDepositsBeforeSecondWithdrawal.sub(TEST_AMOUNT_TWO)
      )
    })

    it('leaves user deposits unchanged if called again', async () => {
      await depositRecord.connect(user).recordWithdrawal(1)
      const userDepositBeforeSecondWithdrawal = await depositRecord.getUserDepositAmount(
        user.address
      )

      await depositRecord.connect(user).recordWithdrawal(TEST_AMOUNT_TWO)

      expect(await depositRecord.getUserDepositAmount(user.address)).to.eq(
        userDepositBeforeSecondWithdrawal
      )
    })
  })

  describe('# setGlobalNetDepositCap', () => {
    const differentCapToTestWith = TEST_GLOBAL_DEPOSIT_CAP.add(1)
    beforeEach(async () => {
      await getSignersAndDeployRecord()
      await grantAndAcceptRole(
        depositRecord,
        deployer,
        deployer,
        await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositRecord.hasRole(
          await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE(),
          user.address
        )
      ).to.eq(false)

      await expect(
        depositRecord.connect(user).setGlobalNetDepositCap(differentCapToTestWith)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_GLOBAL_NET_DEPOSIT_CAP_ROLE()}`
      )
    })

    it('should be settable to a non-zero value', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).to.not.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)

      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should be settable to zero', async () => {
      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)
      expect(await depositRecord.getGlobalNetDepositCap()).to.not.eq(0)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(0)

      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(0)
    })

    it('should correctly set the same value twice', async () => {
      expect(await depositRecord.getGlobalNetDepositCap()).to.not.eq(differentCapToTestWith)
      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)
      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setGlobalNetDepositCap(differentCapToTestWith)

      expect(await depositRecord.getGlobalNetDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should emit a GlobalNetDepositCapChange event', async () => {
      const tx = await depositRecord
        .connect(deployer)
        .setGlobalNetDepositCap(differentCapToTestWith)

      await expect(tx)
        .to.emit(depositRecord, 'GlobalNetDepositCapChange')
        .withArgs(differentCapToTestWith)
    })
  })

  describe('# setUserDepositCap', () => {
    const differentCapToTestWith = TEST_USER_DEPOSIT_CAP.add(1)
    beforeEach(async () => {
      await getSignersAndDeployRecord()
      await grantAndAcceptRole(
        depositRecord,
        deployer,
        deployer,
        await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositRecord.hasRole(await depositRecord.SET_USER_DEPOSIT_CAP_ROLE(), user.address)
      ).to.eq(false)

      await expect(
        depositRecord.connect(user).setUserDepositCap(differentCapToTestWith)
      ).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_USER_DEPOSIT_CAP_ROLE()}`
      )
    })

    it('should be settable to a non-zero value', async () => {
      expect(await depositRecord.getUserDepositCap()).to.not.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      expect(await depositRecord.getUserDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should be settable to zero', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)
      expect(await depositRecord.getUserDepositCap()).to.not.eq(0)

      await depositRecord.connect(deployer).setUserDepositCap(0)

      expect(await depositRecord.getUserDepositCap()).to.eq(0)
    })

    it('should correctly set the same value twice', async () => {
      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)
      expect(await depositRecord.getUserDepositCap()).to.eq(differentCapToTestWith)

      await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      expect(await depositRecord.getUserDepositCap()).to.eq(differentCapToTestWith)
    })

    it('should emit a UserDepositCapChange event', async () => {
      const tx = await depositRecord.connect(deployer).setUserDepositCap(differentCapToTestWith)

      await expect(tx)
        .to.emit(depositRecord, 'UserDepositCapChange')
        .withArgs(differentCapToTestWith)
    })
  })

  describe('# setAllowedHook', () => {
    beforeEach(async () => {
      await getSignersAndDeployRecord()
      await grantAndAcceptRole(
        depositRecord,
        deployer,
        deployer,
        await depositRecord.SET_ALLOWED_HOOK_ROLE()
      )
    })

    it('reverts if not role holder', async () => {
      expect(
        await depositRecord.hasRole(await depositRecord.SET_ALLOWED_HOOK_ROLE(), user.address)
      ).to.eq(false)

      await expect(depositRecord.connect(user).setAllowedHook(deployer.address, true)).revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${await depositRecord.SET_ALLOWED_HOOK_ROLE()}`
      )
    })

    it('should be able to set the allowed status of an account to true', async () => {
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)
    })

    it('should be able to set the allowed status of an account to false', async () => {
      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, false)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)
    })

    it('should be able to set the allowed status of an account to true more than once', async () => {
      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(true)
    })

    it('should be able to set the allowed status of an account to false more than once', async () => {
      await depositRecord.connect(deployer).setAllowedHook(deployer.address, false)
      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)

      await depositRecord.connect(deployer).setAllowedHook(deployer.address, false)

      expect(await depositRecord.isHookAllowed(deployer.address)).to.eq(false)
    })

    it('should emit a AllowedHooksChange event', async () => {
      const tx = await depositRecord.connect(deployer).setAllowedHook(deployer.address, true)

      await expect(tx).to.emit(depositRecord, 'AllowedHooksChange').withArgs(deployer.address, true)
    })
  })
})

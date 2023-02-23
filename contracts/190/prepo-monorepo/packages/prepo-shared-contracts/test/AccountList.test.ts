/* eslint-disable no-await-in-loop */
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { accountListFixture } from './fixtures/AccountListFixture'
import { AccountList } from '../types/generated'

describe('=> AccountList', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let includedUser1: SignerWithAddress
  let includedUser2: SignerWithAddress
  let unincludedUser1: SignerWithAddress
  let unincludedUser2: SignerWithAddress
  let newIncludedUser1: SignerWithAddress
  let newIncludedUser2: SignerWithAddress
  let accountList: AccountList
  let includedUsersArray: string[]
  let unincludedUsersArray: string[]
  let newIncludedUsersArray: string[]
  const blockedArray = [true, true]
  const unblockedArray = [false, false]

  const deployAccountList = async (): Promise<void> => {
    ;[
      deployer,
      owner,
      includedUser1,
      includedUser2,
      unincludedUser1,
      unincludedUser2,
      newIncludedUser1,
      newIncludedUser2,
    ] = await ethers.getSigners()
    accountList = await accountListFixture()
  }

  const setupAccountList = async (): Promise<void> => {
    await deployAccountList()
    includedUsersArray = [includedUser1.address, includedUser2.address]
    unincludedUsersArray = [unincludedUser1.address, unincludedUser2.address]
    newIncludedUsersArray = [newIncludedUser1.address, newIncludedUser2.address]
    await accountList.connect(deployer).transferOwnership(owner.address)
    await accountList.connect(owner).acceptOwnership()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await deployAccountList()
    })

    it('sets nominee to zero address', async () => {
      expect(await accountList.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await accountList.owner()).to.eq(deployer.address)
    })
  })

  describe('# set', () => {
    beforeEach(async () => {
      await setupAccountList()
    })

    it('reverts if not owner', async () => {
      expect(await accountList.owner()).to.not.eq(includedUser1.address)

      await expect(
        accountList.connect(includedUser1).set(includedUsersArray, blockedArray)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('reverts if array length mismatch', async () => {
      expect([includedUser1.address].length).to.not.be.eq(blockedArray.length)

      await expect(
        accountList.connect(owner).set([includedUser1.address], blockedArray)
      ).revertedWith('Array length mismatch')
    })

    it('blocks single account', async () => {
      expect(await accountList.isIncluded(includedUser1.address)).to.eq(false)

      await accountList.connect(owner).set([includedUser1.address], [true])

      expect(await accountList.isIncluded(includedUser1.address)).to.eq(true)
    })

    it('blocks multiple accounts', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(false)
      }

      await accountList.connect(owner).set(includedUsersArray, blockedArray)

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(true)
      }
    })

    it('unblocks single account', async () => {
      await accountList.connect(owner).set([unincludedUser1.address], [true])
      expect(await accountList.isIncluded(unincludedUser1.address)).to.eq(true)

      await accountList.connect(owner).set([unincludedUser1.address], [false])

      expect(await accountList.isIncluded(unincludedUser1.address)).to.eq(false)
    })

    it('unblocks multiple accounts', async () => {
      for (let i = 0; i < unincludedUsersArray.length; i++) {
        await accountList.connect(owner).set([unincludedUsersArray[i]], [true])
        expect(await accountList.isIncluded(unincludedUsersArray[i])).to.eq(true)
      }

      await accountList.connect(owner).set(unincludedUsersArray, unblockedArray)

      for (let i = 0; i < unincludedUsersArray.length; i++) {
        expect(await accountList.isIncluded(unincludedUsersArray[i])).to.eq(false)
      }
    })

    it('blocks and unblocks accounts', async () => {
      await accountList.connect(owner).set([unincludedUser1.address], [true])
      expect(await accountList.isIncluded(unincludedUser1.address)).to.eq(true)
      expect(await accountList.isIncluded(includedUser1.address)).to.eq(false)

      await accountList
        .connect(owner)
        .set([unincludedUser1.address, includedUser1.address], [false, true])

      expect(await accountList.isIncluded(unincludedUser1.address)).to.eq(false)
      expect(await accountList.isIncluded(includedUser1.address)).to.eq(true)
    })

    it('sets lattermost bool value if account passed multiple times', async () => {
      await accountList.connect(owner).set([includedUser1.address], [true])
      expect(await accountList.isIncluded(includedUser1.address)).to.eq(true)

      await accountList
        .connect(owner)
        .set([includedUser1.address, includedUser1.address], [true, false])

      expect(await accountList.isIncluded(includedUser1.address)).to.eq(false)
    })

    it('is idempotent', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(false)
      }

      await accountList.connect(owner).set(includedUsersArray, blockedArray)

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(true)
      }

      await accountList.connect(owner).set(includedUsersArray, blockedArray)

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(true)
      }
    })
  })

  describe('# reset', () => {
    beforeEach(async () => {
      await setupAccountList()
      await accountList.connect(owner).set(includedUsersArray, blockedArray)
    })

    it('reverts if not owner', async () => {
      expect(await accountList.owner()).to.not.eq(includedUser1.address)

      await expect(accountList.connect(includedUser1).reset(includedUsersArray)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('clears list if not setting new list', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(true)
      }

      await accountList.connect(owner).reset([])

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(false)
      }
    })

    it('replaces old list with one account', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(true)
      }
      expect(await accountList.isIncluded(newIncludedUser1.address)).to.eq(false)

      await accountList.connect(owner).reset([newIncludedUser1.address])

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(false)
      }
      expect(await accountList.isIncluded(newIncludedUser1.address)).to.eq(true)
    })

    it('replaces old list with multiple accounts', async () => {
      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(true)
        expect(await accountList.isIncluded(newIncludedUsersArray[i])).to.eq(false)
      }

      await accountList.connect(owner).reset(newIncludedUsersArray)

      for (let i = 0; i < includedUsersArray.length; i++) {
        expect(await accountList.isIncluded(includedUsersArray[i])).to.eq(false)
        expect(await accountList.isIncluded(newIncludedUsersArray[i])).to.eq(true)
      }
    })
  })
})

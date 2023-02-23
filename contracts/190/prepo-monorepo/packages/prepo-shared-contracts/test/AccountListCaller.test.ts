import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { accountListCallerFixture } from './fixtures/AccountListCaller'
import { AccountListCaller } from '../types/generated'

describe('=> AccountListCaller', () => {
  let accountListCaller: AccountListCaller
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let accountList: SignerWithAddress

  beforeEach(async () => {
    ;[deployer, user, accountList] = await ethers.getSigners()
    accountListCaller = await accountListCallerFixture()
  })

  describe('initial state', () => {
    it('initializes account list to zero address', async () => {
      expect(await accountListCaller.getAccountList()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setAccountList', () => {
    it('sets to non-zero address', async () => {
      expect(await accountListCaller.getAccountList()).to.eq(ZERO_ADDRESS)

      await accountListCaller.setAccountList(accountList.address)

      expect(await accountListCaller.getAccountList()).to.eq(accountList.address)
    })

    it('sets to zero address', async () => {
      await accountListCaller.setAccountList(accountList.address)
      expect(await accountListCaller.getAccountList()).to.eq(accountList.address)

      await accountListCaller.setAccountList(ZERO_ADDRESS)

      expect(await accountListCaller.getAccountList()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent if non-zero address', async () => {
      await accountListCaller.setAccountList(accountList.address)
      expect(await accountListCaller.getAccountList()).to.eq(accountList.address)

      await accountListCaller.setAccountList(accountList.address)

      expect(await accountListCaller.getAccountList()).to.eq(accountList.address)
    })

    it('emits AccountListChange', async () => {
      await expect(accountListCaller.setAccountList(accountList.address))
        .to.emit(accountListCaller, 'AccountListChange')
        .withArgs(accountList.address)
    })
  })
})

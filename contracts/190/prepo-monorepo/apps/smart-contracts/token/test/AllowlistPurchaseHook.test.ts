import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { Contract } from 'ethers'
import { formatBytes32String } from 'ethers/lib/utils'
import { allowlistPurchaseHookFixture, fakeAccountListFixture } from './fixtures/MiniSalesFixtures'
import { AllowlistPurchaseHook } from '../types/generated'

chai.use(smock.matchers)

describe('AllowlistPurchaseHook', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let allowedContract: SignerWithAddress
  let allowlistPurchaseHook: AllowlistPurchaseHook
  let allowedAccounts: FakeContract<Contract>
  const dataPayloadA = formatBytes32String('A')

  const deployHook = async (): Promise<void> => {
    ;[deployer, owner, user1, user2, allowedContract] = await ethers.getSigners()
    allowlistPurchaseHook = await allowlistPurchaseHookFixture()
  }

  const setupHook = async (): Promise<void> => {
    await deployHook()
    await allowlistPurchaseHook.connect(deployer).transferOwnership(owner.address)
    await allowlistPurchaseHook.connect(owner).acceptOwnership()
  }

  const setupHookAndList = async (): Promise<void> => {
    await setupHook()
    allowedAccounts = await fakeAccountListFixture()
    await allowlistPurchaseHook.connect(owner).setAllowlist(allowedAccounts.address)
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await deployHook()
    })

    it('sets nominee to zero address', async () => {
      expect(await allowlistPurchaseHook.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await allowlistPurchaseHook.owner()).to.eq(deployer.address)
    })

    it('sets allowlist to zero address', async () => {
      expect(await allowlistPurchaseHook.getAllowlist()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# hook', () => {
    let purchaser: SignerWithAddress
    let recipient: SignerWithAddress

    beforeEach(async () => {
      await setupHookAndList()
      purchaser = user1
      recipient = user2
    })

    it('reverts if recipient not allowed', async () => {
      allowedAccounts.isIncluded.whenCalledWith(recipient.address).returns(false)

      await expect(
        allowlistPurchaseHook
          .connect(allowedContract)
          .hook(purchaser.address, recipient.address, 1, 1, dataPayloadA)
      ).to.be.revertedWith('Recipient not allowed')
    })

    it('reverts if allowlist not set', async () => {
      await allowlistPurchaseHook.connect(owner).setAllowlist(ZERO_ADDRESS)
      expect(await allowlistPurchaseHook.getAllowlist()).to.eq(ZERO_ADDRESS)

      await expect(
        allowlistPurchaseHook
          .connect(allowedContract)
          .hook(purchaser.address, recipient.address, 1, 1, dataPayloadA)
      ).to.be.reverted
    })

    it('reverts if allowlist set to incompatible contract', async () => {
      await allowlistPurchaseHook.connect(owner).setAllowlist(allowlistPurchaseHook.address)
      expect(await allowlistPurchaseHook.getAllowlist()).to.eq(allowlistPurchaseHook.address)
      expect(allowedAccounts.address).to.not.eq(allowlistPurchaseHook.address)

      await expect(
        allowlistPurchaseHook
          .connect(allowedContract)
          .hook(purchaser.address, recipient.address, 1, 1, dataPayloadA)
      ).to.be.reverted
    })

    it('succeeds if recipient allowed', async () => {
      allowedAccounts.isIncluded.whenCalledWith(recipient.address).returns(true)

      await expect(
        allowlistPurchaseHook
          .connect(allowedContract)
          .hook(purchaser.address, recipient.address, 1, 1, dataPayloadA)
      ).to.not.reverted
    })

    it('calls isIncluded with correct parameters', async () => {
      allowedAccounts.isIncluded.whenCalledWith(recipient.address).returns(true)
      await allowlistPurchaseHook
        .connect(allowedContract)
        .hook(purchaser.address, recipient.address, 1, 1, dataPayloadA)

      expect(allowedAccounts.isIncluded).to.have.been.calledWith(recipient.address)
    })
  })

  describe('# setAllowlist', () => {
    beforeEach(async () => {
      await setupHook()
    })

    it('reverts if not owner', async () => {
      expect(await allowlistPurchaseHook.owner()).to.not.eq(user1.address)

      await expect(allowlistPurchaseHook.connect(user1).setAllowlist(JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await allowlistPurchaseHook.getAllowlist()).to.not.eq(JUNK_ADDRESS)

      await allowlistPurchaseHook.connect(owner).setAllowlist(JUNK_ADDRESS)

      expect(await allowlistPurchaseHook.getAllowlist()).to.eq(JUNK_ADDRESS)
      expect(await allowlistPurchaseHook.getAllowlist()).to.not.eq(ZERO_ADDRESS)
    })

    it('sets to zero address', async () => {
      await allowlistPurchaseHook.connect(owner).setAllowlist(JUNK_ADDRESS)
      expect(await allowlistPurchaseHook.getAllowlist()).to.not.eq(ZERO_ADDRESS)

      await allowlistPurchaseHook.connect(owner).setAllowlist(ZERO_ADDRESS)

      expect(await allowlistPurchaseHook.getAllowlist()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await allowlistPurchaseHook.getAllowlist()).to.not.eq(JUNK_ADDRESS)

      await allowlistPurchaseHook.connect(owner).setAllowlist(JUNK_ADDRESS)

      expect(await allowlistPurchaseHook.getAllowlist()).to.eq(JUNK_ADDRESS)

      await allowlistPurchaseHook.connect(owner).setAllowlist(JUNK_ADDRESS)

      expect(await allowlistPurchaseHook.getAllowlist()).to.eq(JUNK_ADDRESS)
    })

    it('emits AccountListChange', async () => {
      const tx = await allowlistPurchaseHook.connect(owner).setAllowlist(JUNK_ADDRESS)

      await expect(tx).to.emit(allowlistPurchaseHook, 'AccountListChange').withArgs(JUNK_ADDRESS)
    })
  })
})

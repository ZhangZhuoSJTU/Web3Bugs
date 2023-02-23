import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { MockContract } from '@defi-wonderland/smock'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { restrictedTransferHookFixture, smockAccountListFixture } from './fixtures/PPOFixtures'
import { RestrictedTransferHook } from '../types/generated'

describe('RestrictedTransferHook', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let ppoToken: SignerWithAddress
  let restrictedTransferHook: RestrictedTransferHook
  let sourceAllowlist: MockContract<Contract>
  let destinationAllowlist: MockContract<Contract>
  let blocklist: MockContract<Contract>

  const deployHook = async (): Promise<void> => {
    ;[deployer, owner, user1, user2, ppoToken] = await ethers.getSigners()
    restrictedTransferHook = await restrictedTransferHookFixture()
  }

  const setupHook = async (): Promise<void> => {
    await deployHook()
    await restrictedTransferHook.connect(deployer).transferOwnership(owner.address)
    await restrictedTransferHook.connect(owner).acceptOwnership()
  }

  const setupHookAndLists = async (): Promise<void> => {
    await setupHook()
    sourceAllowlist = await smockAccountListFixture()
    await restrictedTransferHook.connect(owner).setSourceAllowlist(sourceAllowlist.address)
    destinationAllowlist = await smockAccountListFixture()
    await restrictedTransferHook
      .connect(owner)
      .setDestinationAllowlist(destinationAllowlist.address)
    blocklist = await smockAccountListFixture()
    await restrictedTransferHook.connect(owner).setBlocklist(blocklist.address)
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await deployHook()
    })

    it('sets nominee to zero address', async () => {
      expect(await restrictedTransferHook.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await restrictedTransferHook.owner()).to.eq(deployer.address)
    })

    it('sets source allowlist to zero address', async () => {
      expect(await restrictedTransferHook.getSourceAllowlist()).to.eq(ZERO_ADDRESS)
    })

    it('sets destination allowlist to zero address', async () => {
      expect(await restrictedTransferHook.getDestinationAllowlist()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setSourceAllowlist', () => {
    beforeEach(async () => {
      await setupHook()
    })

    it('reverts if not owner', async () => {
      expect(await restrictedTransferHook.owner()).to.not.eq(user1.address)

      await expect(
        restrictedTransferHook.connect(user1).setSourceAllowlist(JUNK_ADDRESS)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('sets to non-zero address', async () => {
      expect(await restrictedTransferHook.getSourceAllowlist()).to.not.eq(JUNK_ADDRESS)

      await restrictedTransferHook.connect(owner).setSourceAllowlist(JUNK_ADDRESS)

      expect(await restrictedTransferHook.getSourceAllowlist()).to.eq(JUNK_ADDRESS)
      expect(await restrictedTransferHook.getSourceAllowlist()).to.not.eq(ZERO_ADDRESS)
    })

    it('sets to zero address', async () => {
      await restrictedTransferHook.connect(owner).setSourceAllowlist(JUNK_ADDRESS)
      expect(await restrictedTransferHook.getSourceAllowlist()).to.not.eq(ZERO_ADDRESS)

      await restrictedTransferHook.connect(owner).setSourceAllowlist(ZERO_ADDRESS)

      expect(await restrictedTransferHook.getSourceAllowlist()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await restrictedTransferHook.getSourceAllowlist()).to.not.eq(JUNK_ADDRESS)

      await restrictedTransferHook.connect(owner).setSourceAllowlist(JUNK_ADDRESS)

      expect(await restrictedTransferHook.getSourceAllowlist()).to.eq(JUNK_ADDRESS)

      await restrictedTransferHook.connect(owner).setSourceAllowlist(JUNK_ADDRESS)

      expect(await restrictedTransferHook.getSourceAllowlist()).to.eq(JUNK_ADDRESS)
    })

    it('emits SourceAllowlistChange', async () => {
      const tx = await restrictedTransferHook.connect(owner).setSourceAllowlist(JUNK_ADDRESS)

      await expect(tx)
        .to.emit(restrictedTransferHook, 'SourceAllowlistChange')
        .withArgs(JUNK_ADDRESS)
    })
  })

  describe('# setDestinationAllowlist', () => {
    beforeEach(async () => {
      await setupHook()
    })

    it('reverts if not owner', async () => {
      expect(await restrictedTransferHook.owner()).to.not.eq(user1.address)

      await expect(
        restrictedTransferHook.connect(user1).setDestinationAllowlist(JUNK_ADDRESS)
      ).revertedWith('Ownable: caller is not the owner')
    })

    it('sets to non-zero address', async () => {
      expect(await restrictedTransferHook.getDestinationAllowlist()).to.not.eq(JUNK_ADDRESS)

      await restrictedTransferHook.connect(owner).setDestinationAllowlist(JUNK_ADDRESS)

      expect(await restrictedTransferHook.getDestinationAllowlist()).to.eq(JUNK_ADDRESS)
      expect(await restrictedTransferHook.getDestinationAllowlist()).to.not.eq(ZERO_ADDRESS)
    })

    it('sets to zero address', async () => {
      await restrictedTransferHook.connect(owner).setDestinationAllowlist(JUNK_ADDRESS)
      expect(await restrictedTransferHook.getDestinationAllowlist()).to.not.eq(ZERO_ADDRESS)

      await restrictedTransferHook.connect(owner).setDestinationAllowlist(ZERO_ADDRESS)

      expect(await restrictedTransferHook.getDestinationAllowlist()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await restrictedTransferHook.getDestinationAllowlist()).to.not.eq(JUNK_ADDRESS)

      await restrictedTransferHook.connect(owner).setDestinationAllowlist(JUNK_ADDRESS)

      expect(await restrictedTransferHook.getDestinationAllowlist()).to.eq(JUNK_ADDRESS)

      await restrictedTransferHook.connect(owner).setDestinationAllowlist(JUNK_ADDRESS)

      expect(await restrictedTransferHook.getDestinationAllowlist()).to.eq(JUNK_ADDRESS)
    })

    it('emits DestinationAllowlistChange', async () => {
      const tx = await restrictedTransferHook.connect(owner).setDestinationAllowlist(JUNK_ADDRESS)

      await expect(tx)
        .to.emit(restrictedTransferHook, 'DestinationAllowlistChange')
        .withArgs(JUNK_ADDRESS)
    })
  })

  describe('# hook', () => {
    let sender: SignerWithAddress
    let recipient: SignerWithAddress

    beforeEach(async () => {
      await setupHookAndLists()
      sender = user1
      recipient = user2
    })

    it('reverts if source allowlist not set', async () => {
      await restrictedTransferHook.connect(owner).setSourceAllowlist(ZERO_ADDRESS)
      expect(await restrictedTransferHook.getSourceAllowlist()).to.eq(ZERO_ADDRESS)

      await expect(
        restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
      ).to.be.reverted
    })

    it('reverts if source allowlist set to incompatible contract', async () => {
      await restrictedTransferHook.connect(owner).setSourceAllowlist(restrictedTransferHook.address)
      expect(await restrictedTransferHook.getSourceAllowlist()).to.eq(
        restrictedTransferHook.address
      )
      expect(sourceAllowlist.address).to.not.eq(restrictedTransferHook.address)

      await expect(
        restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
      ).to.be.reverted
    })

    it('reverts if destination allowlist not set', async () => {
      await restrictedTransferHook.connect(owner).setDestinationAllowlist(ZERO_ADDRESS)
      expect(await restrictedTransferHook.getDestinationAllowlist()).to.eq(ZERO_ADDRESS)

      await expect(
        restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
      ).to.be.reverted
    })

    it('reverts if destination allowlist set to incompatible contract', async () => {
      await restrictedTransferHook
        .connect(owner)
        .setDestinationAllowlist(restrictedTransferHook.address)
      expect(await restrictedTransferHook.getDestinationAllowlist()).to.eq(
        restrictedTransferHook.address
      )
      expect(destinationAllowlist.address).to.not.eq(restrictedTransferHook.address)

      await expect(
        restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
      ).to.be.reverted
    })

    describe('if sender blocked', () => {
      beforeEach(() => {
        blocklist.isIncluded.whenCalledWith(sender.address).returns(true)
      })

      it('reverts if sender is allowed source', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })

      it('reverts if recipient is allowed destination', async () => {
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })

      it('reverts if sender is allowed source and recipient is allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })

      it('reverts if sender is not allowed source and recipient is not allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(false)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(false)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })
    })

    describe('if recipient blocked', () => {
      beforeEach(() => {
        blocklist.isIncluded.whenCalledWith(recipient.address).returns(true)
      })

      it('reverts if sender is allowed source', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Recipient blocked')
      })

      it('reverts if recipient is allowed destination', async () => {
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Recipient blocked')
      })

      it('reverts if sender is allowed source and recipient is allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Recipient blocked')
      })

      it('reverts if sender is not allowed source and recipient is not allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(false)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(false)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Recipient blocked')
      })
    })

    describe('if both sender and recipient blocked', () => {
      beforeEach(() => {
        blocklist.isIncluded.whenCalledWith(sender.address).returns(true)
        blocklist.isIncluded.whenCalledWith(recipient.address).returns(true)
      })

      it('reverts if sender is allowed source', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })

      it('reverts if recipient is allowed destination', async () => {
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })

      it('reverts if sender is allowed source and recipient is allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })

      it('reverts if sender is not allowed source and recipient is not allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(false)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(false)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Sender blocked')
      })
    })

    describe('if both sender and recipient not blocked', () => {
      beforeEach(() => {
        blocklist.isIncluded.whenCalledWith(sender.address).returns(false)
        blocklist.isIncluded.whenCalledWith(recipient.address).returns(false)
      })

      it('succeeds if sender is allowed source', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.not.reverted
      })

      it('succeeds if recipient is allowed destination', async () => {
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.not.reverted
      })

      it('succeeds if sender is allowed source and recipient is allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(true)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(true)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.not.reverted
      })

      it('reverts if sender is not allowed source and recipient is not allowed destination', async () => {
        sourceAllowlist.isIncluded.whenCalledWith(sender.address).returns(false)
        destinationAllowlist.isIncluded.whenCalledWith(recipient.address).returns(false)

        await expect(
          restrictedTransferHook.connect(ppoToken).hook(sender.address, recipient.address, 1)
        ).to.be.revertedWith('Destination not allowed')
      })
    })
  })
})

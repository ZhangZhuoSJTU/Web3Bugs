import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { safeOwnableFixture } from './fixtures/SafeOwnableFixtures'
import { SafeOwnable } from '../types/generated'

describe('SafeOwnable', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let nominee: SignerWithAddress
  let safeOwnable: SafeOwnable

  const setupSafeOwnable = async (): Promise<void> => {
    ;[deployer, user1, user2] = await ethers.getSigners()
    safeOwnable = await safeOwnableFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupSafeOwnable()
    })

    it('sets owner to deployer', async () => {
      expect(await safeOwnable.owner()).to.eq(deployer.address)
    })
  })

  describe('# transferOwnership', () => {
    beforeEach(async () => {
      await setupSafeOwnable()
      owner = deployer
    })

    it('reverts if not owner and not nominee', async () => {
      expect(await safeOwnable.owner()).to.not.eq(user1.address)
      expect(await safeOwnable.getNominee()).to.not.eq(user1.address)

      expect(safeOwnable.connect(user1).transferOwnership(user1.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if nominee but not owner', async () => {
      nominee = user1
      safeOwnable.connect(owner).transferOwnership(nominee.address)
      expect(await safeOwnable.owner()).to.not.eq(nominee.address)
      expect(await safeOwnable.getNominee()).to.eq(nominee.address)

      expect(safeOwnable.connect(nominee).transferOwnership(user1.address)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets nominee to non-zero address', async () => {
      expect(await safeOwnable.getNominee()).to.not.eq(user1.address)
      expect(user1.address).to.not.eq(ZERO_ADDRESS)

      await safeOwnable.connect(owner).transferOwnership(user1.address)

      expect(await safeOwnable.getNominee()).to.eq(user1.address)
    })

    it('sets nominee to zero address', async () => {
      await safeOwnable.connect(owner).transferOwnership(user1.address)
      expect(await safeOwnable.getNominee()).to.not.eq(ZERO_ADDRESS)

      await safeOwnable.connect(owner).transferOwnership(ZERO_ADDRESS)

      expect(await safeOwnable.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await safeOwnable.getNominee()).to.not.eq(user1.address)

      await safeOwnable.connect(owner).transferOwnership(user1.address)

      expect(await safeOwnable.getNominee()).to.eq(user1.address)

      await safeOwnable.connect(owner).transferOwnership(user1.address)

      expect(await safeOwnable.getNominee()).to.eq(user1.address)
    })

    it('emits NomineeUpdate', async () => {
      const previousNominee = await safeOwnable.getNominee()

      const tx = await safeOwnable.connect(owner).transferOwnership(user1.address)

      await expect(tx)
        .to.emit(safeOwnable, 'NomineeUpdate')
        .withArgs(previousNominee, user1.address)
    })
  })

  describe('# acceptOwnership', () => {
    beforeEach(async () => {
      await setupSafeOwnable()
      nominee = user1
      owner = deployer
      await safeOwnable.connect(owner).transferOwnership(nominee.address)
    })

    it('reverts if not nominee and not owner', async () => {
      expect(await safeOwnable.getNominee()).to.not.eq(user2.address)
      expect(await safeOwnable.owner()).to.not.eq(user2.address)

      expect(safeOwnable.connect(user2).acceptOwnership()).revertedWith('msg.sender != nominee')
    })

    it('reverts if owner but not nominee', async () => {
      expect(await safeOwnable.owner()).to.eq(owner.address)
      expect(await safeOwnable.getNominee()).to.not.eq(owner.address)

      expect(safeOwnable.connect(owner).acceptOwnership()).revertedWith('msg.sender != nominee')
    })

    it('sets owner to nominee', async () => {
      expect(await safeOwnable.owner()).to.not.eq(await safeOwnable.getNominee())

      await safeOwnable.connect(nominee).acceptOwnership()

      expect(await safeOwnable.owner()).to.eq(nominee.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await safeOwnable.getNominee()).to.not.eq(ZERO_ADDRESS)

      await safeOwnable.connect(nominee).acceptOwnership()

      expect(await safeOwnable.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('emits OwnershipTransferred', async () => {
      expect(await safeOwnable.getNominee()).to.eq(nominee.address)
      expect(await safeOwnable.owner()).to.eq(owner.address)

      const tx = await safeOwnable.connect(nominee).acceptOwnership()

      await expect(tx)
        .to.emit(safeOwnable, 'OwnershipTransferred')
        .withArgs(owner.address, nominee.address)
    })

    it('emits NomineeUpdate', async () => {
      expect(await safeOwnable.getNominee()).to.eq(nominee.address)

      const tx = await safeOwnable.connect(nominee).acceptOwnership()

      await expect(tx).to.emit(safeOwnable, 'NomineeUpdate').withArgs(nominee.address, ZERO_ADDRESS)
    })
  })

  describe('# renounceOwnership', () => {
    beforeEach(async () => {
      await setupSafeOwnable()
      nominee = user1
      await safeOwnable.connect(deployer).transferOwnership(owner.address)
      await safeOwnable.connect(owner).acceptOwnership()
    })

    it('reverts if not owner', async () => {
      expect(await safeOwnable.owner()).to.not.eq(user1.address)

      await expect(safeOwnable.connect(user2).renounceOwnership()).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets owner to zero address', async () => {
      expect(await safeOwnable.owner()).to.not.eq(ZERO_ADDRESS)

      await safeOwnable.connect(owner).renounceOwnership()

      expect(await safeOwnable.owner()).to.eq(ZERO_ADDRESS)
    })

    it('sets nominee to zero address', async () => {
      await safeOwnable.connect(deployer).transferOwnership(nominee.address)
      expect(await safeOwnable.getNominee()).to.not.eq(ZERO_ADDRESS)

      await safeOwnable.connect(owner).renounceOwnership()

      expect(await safeOwnable.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('emits OwnershipTransferred', async () => {
      expect(await safeOwnable.owner()).to.eq(owner.address)

      const tx = await safeOwnable.connect(owner).renounceOwnership()

      await expect(tx)
        .to.emit(safeOwnable, 'OwnershipTransferred')
        .withArgs(owner.address, ZERO_ADDRESS)
    })

    it('emits NomineeUpdate if nominee is not zero address', async () => {
      await safeOwnable.connect(deployer).transferOwnership(nominee.address)
      expect(await safeOwnable.getNominee()).to.eq(nominee.address)

      const tx = await safeOwnable.connect(owner).renounceOwnership()

      await expect(tx).to.emit(safeOwnable, 'NomineeUpdate').withArgs(nominee.address, ZERO_ADDRESS)
    })

    it('emits NomineeUpdate if nominee is zero address', async () => {
      expect(await safeOwnable.getNominee()).to.eq(ZERO_ADDRESS)

      const tx = await safeOwnable.connect(owner).renounceOwnership()

      await expect(tx).to.emit(safeOwnable, 'NomineeUpdate').withArgs(ZERO_ADDRESS, ZERO_ADDRESS)
    })
  })
})

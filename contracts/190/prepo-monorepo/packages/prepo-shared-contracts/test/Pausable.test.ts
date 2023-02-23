import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { pausableTestFixture } from './fixtures/PausableFixture'
import { PausableTest } from '../types/generated'

describe('Pausable', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let pausable: PausableTest

  const setupPausable = async (): Promise<void> => {
    ;[deployer, user1, user2] = await ethers.getSigners()
    owner = deployer
    pausable = await pausableTestFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupPausable()
    })

    it('sets owner to deployer', async () => {
      expect(await pausable.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await pausable.getNominee()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setPaused', () => {
    beforeEach(async () => {
      await setupPausable()
    })

    it('reverts if not owner', async () => {
      expect(await pausable.owner()).to.not.eq(user1.address)

      await expect(pausable.connect(user1).setPaused(true)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('pauses', async () => {
      expect(await pausable.isPaused()).to.eq(false)

      await pausable.connect(owner).setPaused(true)

      expect(await pausable.isPaused()).to.eq(true)
    })

    it('unpauses', async () => {
      await pausable.connect(owner).setPaused(true)
      expect(await pausable.isPaused()).to.eq(true)

      await pausable.connect(owner).setPaused(false)

      expect(await pausable.isPaused()).to.eq(false)
    })

    it('is idempotent', async () => {
      expect(await pausable.isPaused()).to.eq(false)

      await pausable.connect(owner).setPaused(true)

      expect(await pausable.isPaused()).to.eq(true)

      await pausable.connect(owner).setPaused(true)

      expect(await pausable.isPaused()).to.eq(true)
    })

    it('emits paused change if paused', async () => {
      const tx = await pausable.connect(owner).setPaused(true)

      await expect(tx).to.emit(pausable, 'PausedChange(bool)').withArgs(true)
    })

    it('emits paused change if unpaused', async () => {
      const tx = await pausable.connect(owner).setPaused(false)

      await expect(tx).to.emit(pausable, 'PausedChange(bool)').withArgs(false)
    })
  })

  describe('# testWhenNotPaused', async () => {
    beforeEach(async () => {
      await setupPausable()
    })

    it('reverts if paused', async () => {
      await pausable.connect(owner).setPaused(true)
      expect(await pausable.isPaused()).to.eq(true)

      await expect(pausable.testWhenNotPaused()).revertedWith('Paused')
    })

    it('succeeds if not paused', async () => {
      await pausable.connect(owner).setPaused(false)
      expect(await pausable.isPaused()).to.eq(false)

      await expect(pausable.testWhenNotPaused()).to.not.reverted
    })
  })
})

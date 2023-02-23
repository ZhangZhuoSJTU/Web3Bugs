import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { protectedHookTestFixture } from './fixtures/ProtectedHookFixture'
import { ProtectedHookTest } from '../types/generated'

describe('ProtectedHook', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let protectedHook: ProtectedHookTest

  const setupProtectedHook = async (): Promise<void> => {
    ;[deployer, user1, user2] = await ethers.getSigners()
    owner = deployer
    protectedHook = await protectedHookTestFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupProtectedHook()
    })

    it('sets owner to deployer', async () => {
      expect(await protectedHook.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await protectedHook.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets allowed contract to zero address', async () => {
      expect(await protectedHook.getAllowedContract()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setAllowedContract', () => {
    beforeEach(async () => {
      await setupProtectedHook()
    })

    it('reverts if not owner', async () => {
      expect(await protectedHook.owner()).to.not.eq(user1.address)

      await expect(protectedHook.connect(user1).setAllowedContract(JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await protectedHook.getAllowedContract()).to.eq(ZERO_ADDRESS)

      await protectedHook.connect(owner).setAllowedContract(JUNK_ADDRESS)

      expect(await protectedHook.getAllowedContract()).to.eq(JUNK_ADDRESS)
    })

    it('sets to zero address', async () => {
      await protectedHook.connect(owner).setAllowedContract(JUNK_ADDRESS)
      expect(await protectedHook.getAllowedContract()).to.eq(JUNK_ADDRESS)

      await protectedHook.connect(owner).setAllowedContract(ZERO_ADDRESS)

      expect(await protectedHook.getAllowedContract()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await protectedHook.getAllowedContract()).to.eq(ZERO_ADDRESS)

      await protectedHook.connect(owner).setAllowedContract(JUNK_ADDRESS)

      expect(await protectedHook.getAllowedContract()).to.eq(JUNK_ADDRESS)

      await protectedHook.connect(owner).setAllowedContract(JUNK_ADDRESS)

      expect(await protectedHook.getAllowedContract()).to.eq(JUNK_ADDRESS)
    })

    it('emits AllowedContractChange', async () => {
      const tx = await protectedHook.connect(owner).setAllowedContract(JUNK_ADDRESS)

      await expect(tx)
        .to.emit(protectedHook, 'AllowedContractChange(address)')
        .withArgs(JUNK_ADDRESS)
    })
  })

  describe('# testOnlyAllowedContract', async () => {
    beforeEach(async () => {
      await setupProtectedHook()
    })

    it("reverts if caller isn't allowed", async () => {
      await protectedHook.connect(owner).setAllowedContract(user1.address)
      expect(await protectedHook.getAllowedContract()).not.eq(owner.address)

      await expect(protectedHook.connect(owner).testOnlyAllowedContract()).revertedWith(
        'msg.sender != allowed contract'
      )
    })

    it('succeeds if caller is allowed', async () => {
      await protectedHook.connect(owner).setAllowedContract(user1.address)
      expect(await protectedHook.getAllowedContract()).eq(user1.address)

      await expect(protectedHook.connect(user1).testOnlyAllowedContract()).to.not.reverted
    })
  })
})

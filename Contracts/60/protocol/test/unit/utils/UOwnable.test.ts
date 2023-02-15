import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { MockUOwnable, MockUOwnable__factory } from '../../../types/generated'

const { ethers } = HRE

describe('UOwnable', () => {
  let owner: SignerWithAddress
  let user: SignerWithAddress
  let uOwnable: MockUOwnable

  beforeEach(async () => {
    ;[owner, user] = await ethers.getSigners()
    uOwnable = await new MockUOwnable__factory(owner).deploy()
  })

  describe('#UOwnable__initialize', async () => {
    it('initializes owner', async () => {
      expect(await uOwnable.owner()).to.equal(ethers.constants.AddressZero)

      await expect(uOwnable.connect(owner).__initialize())
        .to.emit(uOwnable, 'OwnershipTransferred')
        .withArgs(ethers.constants.AddressZero, owner.address)

      expect(await uOwnable.owner()).to.equal(owner.address)
    })
  })

  describe('#transferOwnership', async () => {
    beforeEach(async () => {
      await uOwnable.connect(owner).__initialize()
    })

    it('transfers owner', async () => {
      await expect(uOwnable.connect(owner).transferOwnership(user.address))
        .to.emit(uOwnable, 'OwnershipTransferred')
        .withArgs(owner.address, user.address)

      expect(await uOwnable.owner()).to.equal(user.address)
    })

    it('reverts if not owner', async () => {
      await expect(uOwnable.connect(user).transferOwnership(user.address)).to.be.revertedWith(
        `UOwnableNotOwnerError("${user.address}")`,
      )
    })

    it('reverts if zero address', async () => {
      await expect(uOwnable.connect(owner).transferOwnership(ethers.constants.AddressZero)).to.be.revertedWith(
        `UOwnableZeroAddressError()`,
      )
    })
  })

  describe('#renounceOwnership', async () => {
    beforeEach(async () => {
      await uOwnable.connect(owner).__initialize()
    })

    it('renounces owner', async () => {
      await expect(uOwnable.connect(owner).renounceOwnership())
        .to.emit(uOwnable, 'OwnershipTransferred')
        .withArgs(owner.address, ethers.constants.AddressZero)

      expect(await uOwnable.owner()).to.equal(ethers.constants.AddressZero)
    })

    it('reverts if not owner', async () => {
      await expect(uOwnable.connect(user).renounceOwnership()).to.be.revertedWith(
        `UOwnableNotOwnerError("${user.address}")`,
      )
    })
  })
})

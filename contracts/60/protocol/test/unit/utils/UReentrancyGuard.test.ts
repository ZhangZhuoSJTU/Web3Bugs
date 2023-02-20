import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { MockUReentrancyGuard, MockUReentrancyGuard__factory } from '../../../types/generated'

const { ethers } = HRE

describe('UOwnable', () => {
  let owner: SignerWithAddress
  let user: SignerWithAddress
  let uReentrancyGuard: MockUReentrancyGuard

  beforeEach(async () => {
    ;[owner] = await ethers.getSigners()
    uReentrancyGuard = await new MockUReentrancyGuard__factory(owner).deploy()
  })

  describe('#UReentrancyGuard__initialize', async () => {
    it('unset if not initialize', async () => {
      expect(await uReentrancyGuard.__status()).to.equal(0)
    })

    it('initializes status', async () => {
      await uReentrancyGuard.connect(owner).__initialize()
      expect(await uReentrancyGuard.__status()).to.equal(1)
    })
  })

  describe('doesnt reenter', async () => {
    it('reverts', async () => {
      await expect(uReentrancyGuard.noReenter()).to.emit(uReentrancyGuard, 'NoOp')
    })
  })

  describe('reenter same function', async () => {
    it('reverts', async () => {
      await expect(uReentrancyGuard.reenterRecursive()).to.be.revertedWith(`UReentrancyGuardReentrantCallError()`)
    })
  })

  describe('reenter different function', async () => {
    it('reverts', async () => {
      await expect(uReentrancyGuard.reenterDifferent()).to.be.revertedWith(`UReentrancyGuardReentrantCallError()`)
    })
  })
})

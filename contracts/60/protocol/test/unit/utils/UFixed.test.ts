import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { utils } from 'ethers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { MockUFixed18, MockUFixed18__factory } from '../../../types/generated'

const { ethers } = HRE

describe('UFixed18', () => {
  let user: SignerWithAddress
  let uFixed18: MockUFixed18

  beforeEach(async () => {
    ;[user] = await ethers.getSigners()
    uFixed18 = await new MockUFixed18__factory(user).deploy()
  })

  describe('#zero', async () => {
    it('returns zero', async () => {
      expect(await uFixed18.zero()).to.equal(0)
    })
  })

  describe('#one', async () => {
    it('returns zero', async () => {
      expect(await uFixed18.one()).to.equal(utils.parseEther('1'))
    })
  })

  describe('#from(uint256)', async () => {
    it('creates new', async () => {
      expect(await uFixed18['from(uint256)'](10)).to.equal(utils.parseEther('10'))
    })
  })

  describe('#from(Fixed18)', async () => {
    it('creates positive', async () => {
      expect(await uFixed18['from(int256)'](utils.parseEther('10'))).to.equal(utils.parseEther('10'))
    })

    it('reverts if negative', async () => {
      await expect(uFixed18['from(int256)'](utils.parseEther('-10'))).to.be.revertedWith(
        `UFixed18UnderflowError(${utils.parseEther('-10')})`,
      )
    })
  })

  describe('#isZero', async () => {
    it('returns true', async () => {
      expect(await uFixed18.isZero(0)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await uFixed18.isZero(1)).to.equal(false)
    })
  })

  describe('#add', async () => {
    it('adds', async () => {
      expect(await uFixed18.add(10, 20)).to.equal(30)
    })
  })

  describe('#sub', async () => {
    it('subs', async () => {
      expect(await uFixed18.sub(20, 10)).to.equal(10)
    })
  })

  describe('#mul', async () => {
    it('muls', async () => {
      expect(await uFixed18.mul(utils.parseEther('20'), utils.parseEther('10'))).to.equal(utils.parseEther('200'))
    })
  })

  describe('#div', async () => {
    it('divs', async () => {
      expect(await uFixed18.div(utils.parseEther('20'), utils.parseEther('10'))).to.equal(utils.parseEther('2'))
    })

    it('divs and floors', async () => {
      expect(await uFixed18.div(21, utils.parseEther('10'))).to.equal(2)
    })
  })

  describe('#eq', async () => {
    it('returns true', async () => {
      expect(await uFixed18.eq(12, 12)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await uFixed18.eq(11, 12)).to.equal(false)
    })
  })

  describe('#gt', async () => {
    it('returns true', async () => {
      expect(await uFixed18.gt(13, 12)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await uFixed18.gt(12, 12)).to.equal(false)
    })

    it('returns false', async () => {
      expect(await uFixed18.gt(11, 12)).to.equal(false)
    })
  })

  describe('#lt', async () => {
    it('returns false', async () => {
      expect(await uFixed18.lt(13, 12)).to.equal(false)
    })

    it('returns false', async () => {
      expect(await uFixed18.lt(12, 12)).to.equal(false)
    })

    it('returns true', async () => {
      expect(await uFixed18.lt(11, 12)).to.equal(true)
    })
  })

  describe('#gte', async () => {
    it('returns true', async () => {
      expect(await uFixed18.gte(13, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await uFixed18.gte(12, 12)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await uFixed18.gte(11, 12)).to.equal(false)
    })
  })

  describe('#lte', async () => {
    it('returns false', async () => {
      expect(await uFixed18.lte(13, 12)).to.equal(false)
    })

    it('returns true', async () => {
      expect(await uFixed18.lte(12, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await uFixed18.lte(11, 12)).to.equal(true)
    })
  })

  describe('#compare', async () => {
    it('is positive', async () => {
      expect(await uFixed18.compare(13, 12)).to.equal(2)
    })

    it('is zero', async () => {
      expect(await uFixed18.compare(12, 12)).to.equal(1)
    })

    it('is negative', async () => {
      expect(await uFixed18.compare(11, 12)).to.equal(0)
    })
  })

  describe('#ratio', async () => {
    it('returns ratio', async () => {
      expect(await uFixed18.ratio(2000, 100)).to.equal(utils.parseEther('20'))
    })
  })

  describe('#min', async () => {
    it('returns min', async () => {
      expect(await uFixed18.min(2000, 100)).to.equal(100)
    })

    it('returns min', async () => {
      expect(await uFixed18.min(100, 2000)).to.equal(100)
    })
  })

  describe('#max', async () => {
    it('returns max', async () => {
      expect(await uFixed18.max(2000, 100)).to.equal(2000)
    })

    it('returns max', async () => {
      expect(await uFixed18.max(100, 2000)).to.equal(2000)
    })
  })

  describe('#truncate', async () => {
    it('returns floor', async () => {
      expect(await uFixed18.truncate(utils.parseEther('123.456'))).to.equal(123)
    })
  })
})

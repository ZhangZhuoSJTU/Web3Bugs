import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { utils } from 'ethers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { MockFixed18, MockFixed18__factory } from '../../../types/generated'

const { ethers } = HRE

describe('Fixed18', () => {
  let user: SignerWithAddress
  let fixed18: MockFixed18

  beforeEach(async () => {
    ;[user] = await ethers.getSigners()
    fixed18 = await new MockFixed18__factory(user).deploy()
  })

  describe('#zero', async () => {
    it('returns zero', async () => {
      expect(await fixed18.zero()).to.equal(0)
    })
  })

  describe('#one', async () => {
    it('returns zero', async () => {
      expect(await fixed18.one()).to.equal(utils.parseEther('1'))
    })
  })

  describe('#negOne', async () => {
    it('returns zero', async () => {
      expect(await fixed18.negOne()).to.equal(utils.parseEther('-1'))
    })
  })

  describe('#from(int256)', async () => {
    it('creates new', async () => {
      expect(await fixed18['from(int256)'](10)).to.equal(utils.parseEther('10'))
    })
  })

  describe('#from(Fixed18)', async () => {
    it('creates positive', async () => {
      expect(await fixed18['from(int256,uint256)'](1, utils.parseEther('10'))).to.equal(utils.parseEther('10'))
    })

    it('creates zero', async () => {
      expect(await fixed18['from(int256,uint256)'](0, utils.parseEther('10'))).to.equal(0)
    })

    it('creates negative', async () => {
      expect(await fixed18['from(int256,uint256)'](-1, utils.parseEther('10'))).to.equal(utils.parseEther('-10'))
    })
  })

  describe('#from(UFixed18)', async () => {
    it('creates new', async () => {
      expect(await fixed18['from(uint256)'](utils.parseEther('10'))).to.equal(utils.parseEther('10'))
    })

    it('reverts if too large', async () => {
      const TOO_LARGE = ethers.BigNumber.from(2).pow(256).sub(10)
      await expect(fixed18['from(uint256)'](TOO_LARGE)).to.be.revertedWith(`Fixed18OverflowError(${TOO_LARGE})`)
    })
  })

  describe('#isZero', async () => {
    it('returns true', async () => {
      expect(await fixed18.isZero(0)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await fixed18.isZero(1)).to.equal(false)
    })
  })

  describe('#add', async () => {
    it('adds', async () => {
      expect(await fixed18.add(10, 20)).to.equal(30)
    })

    it('adds', async () => {
      expect(await fixed18.add(-10, -20)).to.equal(-30)
    })
  })

  describe('#sub', async () => {
    it('subs', async () => {
      expect(await fixed18.sub(20, 10)).to.equal(10)
    })

    it('subs', async () => {
      expect(await fixed18.sub(-20, -10)).to.equal(-10)
    })
  })

  describe('#mul', async () => {
    it('muls', async () => {
      expect(await fixed18.mul(utils.parseEther('20'), utils.parseEther('10'))).to.equal(utils.parseEther('200'))
    })

    it('muls', async () => {
      expect(await fixed18.mul(utils.parseEther('-20'), utils.parseEther('-10'))).to.equal(utils.parseEther('200'))
    })
  })

  describe('#div', async () => {
    it('divs', async () => {
      expect(await fixed18.div(utils.parseEther('20'), utils.parseEther('10'))).to.equal(utils.parseEther('2'))
    })

    it('divs', async () => {
      expect(await fixed18.div(utils.parseEther('-20'), utils.parseEther('-10'))).to.equal(utils.parseEther('2'))
    })

    it('divs and floors', async () => {
      expect(await fixed18.div(21, utils.parseEther('10'))).to.equal(2)
    })
  })

  describe('#eq', async () => {
    it('returns true', async () => {
      expect(await fixed18.eq(12, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.eq(-12, -12)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await fixed18.eq(11, 12)).to.equal(false)
    })
  })

  describe('#gt', async () => {
    it('returns true', async () => {
      expect(await fixed18.gt(13, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.gt(-12, -13)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await fixed18.gt(12, 12)).to.equal(false)
    })

    it('returns false', async () => {
      expect(await fixed18.gt(11, 12)).to.equal(false)
    })
  })

  describe('#lt', async () => {
    it('returns false', async () => {
      expect(await fixed18.lt(13, 12)).to.equal(false)
    })

    it('returns false', async () => {
      expect(await fixed18.lt(12, 12)).to.equal(false)
    })

    it('returns true', async () => {
      expect(await fixed18.lt(11, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.lt(-12, -11)).to.equal(true)
    })
  })

  describe('#gte', async () => {
    it('returns true', async () => {
      expect(await fixed18.gte(13, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.gte(-12, -13)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.gte(12, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.gte(-12, -12)).to.equal(true)
    })

    it('returns false', async () => {
      expect(await fixed18.gte(11, 12)).to.equal(false)
    })
  })

  describe('#lte', async () => {
    it('returns false', async () => {
      expect(await fixed18.lte(13, 12)).to.equal(false)
    })

    it('returns true', async () => {
      expect(await fixed18.lte(12, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.lte(-12, -12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.lte(11, 12)).to.equal(true)
    })

    it('returns true', async () => {
      expect(await fixed18.lte(-12, -11)).to.equal(true)
    })
  })

  describe('#compare', async () => {
    it('is positive', async () => {
      expect(await fixed18.compare(13, 12)).to.equal(2)
    })

    it('is positive', async () => {
      expect(await fixed18.compare(-12, -13)).to.equal(2)
    })

    it('is zero', async () => {
      expect(await fixed18.compare(12, 12)).to.equal(1)
    })

    it('is negative', async () => {
      expect(await fixed18.compare(11, 12)).to.equal(0)
    })

    it('is negative', async () => {
      expect(await fixed18.compare(-12, -11)).to.equal(0)
    })
  })

  describe('#ratio', async () => {
    it('returns ratio', async () => {
      expect(await fixed18.ratio(2000, 100)).to.equal(utils.parseEther('20'))
    })

    it('returns ratio', async () => {
      expect(await fixed18.ratio(-2000, -100)).to.equal(utils.parseEther('20'))
    })
  })

  describe('#min', async () => {
    it('returns min', async () => {
      expect(await fixed18.min(2000, 100)).to.equal(100)
    })

    it('returns min', async () => {
      expect(await fixed18.min(-2000, -100)).to.equal(-2000)
    })

    it('returns min', async () => {
      expect(await fixed18.min(100, 2000)).to.equal(100)
    })

    it('returns min', async () => {
      expect(await fixed18.min(-100, -2000)).to.equal(-2000)
    })
  })

  describe('#max', async () => {
    it('returns max', async () => {
      expect(await fixed18.max(2000, 100)).to.equal(2000)
    })

    it('returns max', async () => {
      expect(await fixed18.max(-2000, -100)).to.equal(-100)
    })

    it('returns max', async () => {
      expect(await fixed18.max(100, 2000)).to.equal(2000)
    })

    it('returns max', async () => {
      expect(await fixed18.max(-100, -2000)).to.equal(-100)
    })
  })

  describe('#truncate', async () => {
    it('returns floor', async () => {
      expect(await fixed18.truncate(utils.parseEther('123.456'))).to.equal(123)
    })

    it('returns floor', async () => {
      expect(await fixed18.truncate(utils.parseEther('-123.456'))).to.equal(-123)
    })
  })

  describe('#sign', async () => {
    it('is positive', async () => {
      expect(await fixed18.sign(12)).to.equal(1)
    })

    it('is zero', async () => {
      expect(await fixed18.sign(0)).to.equal(0)
    })

    it('is negative', async () => {
      expect(await fixed18.sign(-12)).to.equal(-1)
    })
  })

  describe('#abs', async () => {
    it('is positive', async () => {
      expect(await fixed18.abs(12)).to.equal(12)
    })
    it('is negative', async () => {
      expect(await fixed18.abs(-12)).to.equal(12)
    })
  })
})

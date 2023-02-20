import { MockContract } from '@ethereum-waffle/mock-contract'
import { utils } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { ChainlinkOracle__factory, ShortEther, ShortEther__factory } from '../../../types/generated'

const { ethers } = HRE

describe('ShortEther', () => {
  let user: SignerWithAddress
  let oracle: MockContract
  let shortEther: ShortEther

  beforeEach(async () => {
    ;[user] = await ethers.getSigners()
    oracle = await waffle.deployMockContract(user, ChainlinkOracle__factory.abi)
    shortEther = await new ShortEther__factory(user).deploy(oracle.address)
  })

  describe('#sync', async () => {
    it('calls sync on oracle', async () => {
      await oracle.mock.sync.withArgs().returns()

      await shortEther.connect(user).sync()
    })
  })

  describe('#priceAtVersion', async () => {
    it('modifies oracle per payoff', async () => {
      await oracle.mock.priceAtVersion.withArgs(1).returns(utils.parseEther('11'))

      expect(await shortEther.priceAtVersion(1)).to.equal(utils.parseEther('-11'))
    })
  })

  describe('#timestampAtVersion', async () => {
    const TIMESTAMP = 1636920000

    it('returns oracle timestamp', async () => {
      await oracle.mock.timestampAtVersion.withArgs(1).returns(TIMESTAMP)

      expect(await shortEther.timestampAtVersion(1)).to.equal(TIMESTAMP)
    })
  })

  describe('#currentVersion', async () => {
    it('returns oracle version', async () => {
      await oracle.mock.currentVersion.withArgs().returns(2)

      expect(await shortEther.currentVersion()).to.equal(2)
    })
  })

  describe('#rate', async () => {
    const RATE_PER_SECOND = utils.parseEther('1').div(60 * 60 * 24 * 365)

    it('handles zero maker', async () => {
      expect(await shortEther.rate({ maker: 0, taker: 0 })).to.equal(utils.parseEther('0'))
      expect(await shortEther.rate({ maker: 0, taker: 100 })).to.equal(utils.parseEther('0'))
    })

    it('returns -100 to 100 centered on 50% utilization', async () => {
      expect(await shortEther.rate({ maker: 100, taker: 0 })).to.equal(RATE_PER_SECOND.mul(-1))
      expect(await shortEther.rate({ maker: 100, taker: 25 })).to.equal(RATE_PER_SECOND.div(-2))
      expect(await shortEther.rate({ maker: 100, taker: 50 })).to.equal(utils.parseEther('0'))
      expect(await shortEther.rate({ maker: 100, taker: 75 })).to.equal(RATE_PER_SECOND.div(2))
      expect(await shortEther.rate({ maker: 100, taker: 100 })).to.equal(RATE_PER_SECOND)
    })

    it('caps rate at 100', async () => {
      expect(await shortEther.rate({ maker: 100, taker: 125 })).to.equal(RATE_PER_SECOND)
    })
  })

  describe('#payoff', async () => {
    it('returns the square of price', async () => {
      expect(await shortEther.payoff(utils.parseEther('9'))).to.equal(utils.parseEther('-9'))
      expect(await shortEther.payoff(utils.parseEther('11'))).to.equal(utils.parseEther('-11'))
    })
  })

  describe('#maintenance', async () => {
    it('returns correct maintenance', async () => {
      expect(await shortEther.maintenance()).to.equal(utils.parseEther('0.3'))
    })
  })

  describe('#fundingFee', async () => {
    it('returns correct fundingFee', async () => {
      expect(await shortEther.fundingFee()).to.equal(utils.parseEther('0.1'))
    })
  })

  describe('#makerFee', async () => {
    it('returns correct makerFee', async () => {
      expect(await shortEther.makerFee()).to.equal(utils.parseEther('0'))
    })
  })

  describe('#takerFee', async () => {
    it('returns correct takerFee', async () => {
      expect(await shortEther.takerFee()).to.equal(utils.parseEther('0'))
    })
  })

  describe('#makerLimit', async () => {
    it('returns correct makerLimit', async () => {
      expect(await shortEther.makerLimit()).to.equal(utils.parseEther('1000'))
    })
  })
})

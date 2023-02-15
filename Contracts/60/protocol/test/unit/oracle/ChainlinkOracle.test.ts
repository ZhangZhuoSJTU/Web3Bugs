import { MockContract } from '@ethereum-waffle/mock-contract'
import { utils } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import HRE, { waffle } from 'hardhat'

import { ChainlinkOracle, IChainlinkFeed__factory, ChainlinkOracle__factory } from '../../../types/generated'

const { ethers } = HRE

const TIMESTAMP = 1636920000
const HOUR = 60 * 60

describe('ChainlinkOracle', () => {
  let owner: SignerWithAddress
  let user: SignerWithAddress

  let feed: MockContract

  let oracle: ChainlinkOracle

  beforeEach(async () => {
    ;[owner, user] = await ethers.getSigners()
    feed = await waffle.deployMockContract(owner, IChainlinkFeed__factory.abi)
  })

  describe('#constructor', async () => {
    it('sets initial params', async () => {
      await feed.mock.decimals.withArgs().returns(8)
      await feed.mock.latestRoundData
        .withArgs()
        .returns(123, ethers.BigNumber.from(111100000000), TIMESTAMP, TIMESTAMP + HOUR, 123)

      oracle = await new ChainlinkOracle__factory(owner).deploy(feed.address)

      expect(await oracle.feed()).to.equal(feed.address)
      expect(await oracle.minDelay()).to.equal(HOUR / 2)
      expect(await oracle.priceAtVersion(0)).to.equal(utils.parseEther('1111'))
      expect(await oracle.timestampAtVersion(0)).to.equal(TIMESTAMP + HOUR)
      expect(await oracle.currentVersion()).to.equal(0)
    })
  })

  describe('#sync', async () => {
    beforeEach(async () => {
      await feed.mock.decimals.withArgs().returns(8)
      await feed.mock.latestRoundData
        .withArgs()
        .returns(123, ethers.BigNumber.from(111100000000), TIMESTAMP, TIMESTAMP + HOUR, 123)

      oracle = await new ChainlinkOracle__factory(owner).deploy(feed.address)
    })

    it('doesnt sync new version if not available', async () => {
      await feed.mock.latestRoundData
        .withArgs()
        .returns(123, ethers.BigNumber.from(111100000000), TIMESTAMP, TIMESTAMP + HOUR, 123)

      await expect(oracle.connect(user).sync())

      expect(await oracle.priceAtVersion(0)).to.equal(utils.parseEther('1111'))
      expect(await oracle.timestampAtVersion(0)).to.equal(TIMESTAMP + HOUR)
      expect(await oracle.currentVersion()).to.equal(0)
    })

    it('doesnt sync if delay has not been reached', async () => {
      await feed.mock.latestRoundData
        .withArgs()
        .returns(124, ethers.BigNumber.from(122200000000), TIMESTAMP + HOUR, TIMESTAMP + HOUR + HOUR / 3, 124)

      await expect(oracle.connect(user).sync())

      expect(await oracle.priceAtVersion(0)).to.equal(utils.parseEther('1111'))
      expect(await oracle.timestampAtVersion(0)).to.equal(TIMESTAMP + HOUR)
      expect(await oracle.currentVersion()).to.equal(0)
    })

    it('syncs new version if available', async () => {
      await feed.mock.latestRoundData
        .withArgs()
        .returns(124, ethers.BigNumber.from(122200000000), TIMESTAMP + HOUR, TIMESTAMP + HOUR + HOUR, 124)

      await expect(oracle.connect(user).sync())
        .to.emit(oracle, 'Version')
        .withArgs(1, TIMESTAMP + 2 * HOUR, utils.parseEther('1222'))

      expect(await oracle.priceAtVersion(1)).to.equal(utils.parseEther('1222'))
      expect(await oracle.timestampAtVersion(1)).to.equal(TIMESTAMP + 2 * HOUR)
      expect(await oracle.currentVersion()).to.equal(1)
    })
  })

  describe('#updateMinDelay', async () => {
    beforeEach(async () => {
      await feed.mock.decimals.withArgs().returns(8)
      await feed.mock.latestRoundData
        .withArgs()
        .returns(123, ethers.BigNumber.from(111100000000), TIMESTAMP, TIMESTAMP + HOUR, 123)

      oracle = await new ChainlinkOracle__factory(owner).deploy(feed.address)
    })

    it('updates the minimum delay', async () => {
      await expect(oracle.connect(owner).updateMinDelay(HOUR)).to.emit(oracle, 'MinDelayUpdated').withArgs(HOUR)

      expect(await oracle.minDelay()).to.equal(HOUR)
    })

    it('reverts if not owner', async () => {
      await expect(oracle.connect(user).updateMinDelay(HOUR)).to.be.revertedWith(
        `UOwnableNotOwnerError("${user.address}")`,
      )
    })
  })
})

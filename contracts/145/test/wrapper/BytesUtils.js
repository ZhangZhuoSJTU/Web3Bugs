const packet = require('dns-packet')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { utils, BigNumber: BN } = ethers
const namehash = require('eth-ens-namehash').hash

const NULL_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

function encodeName(name) {
  return '0x' + packet.name.encode(name).toString('hex')
}

const labelhash = (label) => utils.keccak256(utils.toUtf8Bytes(label))

describe('BytesUtils', () => {
  let BytesUtils

  before(async () => {
    const BytesUtilsFactory = await ethers.getContractFactory("contracts/wrapper/test/TestBytesUtils.sol:TestBytesUtils")
    BytesUtils = await BytesUtilsFactory.deploy()
  })

  describe('readLabel()', () => {
    it('Reads the first label from a name', async () => {
      let [hash, offset] = await BytesUtils.readLabel(encodeName('test.tld'), 0)
      expect(hash).to.equal(labelhash('test'))
      expect(offset.toNumber()).to.equal(5)
    })

    it('Reads subsequent labels from a name', async () => {
      let [hash, offset] = await BytesUtils.readLabel(encodeName('test.tld'), 5)
      expect(hash).to.equal(labelhash('tld'))
      expect(offset.toNumber()).to.equal(9)
    })

    it('Reads the terminator from a name', async () => {
      let [hash, offset] = await BytesUtils.readLabel(encodeName('test.tld'), 9)
      expect(hash).to.equal(NULL_HASH)
      expect(offset.toNumber()).to.equal(10)
    })

    it('Reverts when given an empty string', async () => {
      await expect(BytesUtils.readLabel('0x', 0)).to.be.revertedWith('readLabel: Index out of bounds')
    })

    it('Reverts when given an index after the end of the string', async () => {
      await expect(BytesUtils.readLabel(encodeName('test.tld'), 10)).to.be.revertedWith('readLabel: Index out of bounds')
    })
  })

  describe('namehash()', () => {
    it('Hashes the empty name to 0', async () => {
      expect(await BytesUtils.namehash(encodeName('.'), 0)).to.equal(namehash(''))
    })

    it('Hashes .eth correctly', async () => {
      expect(await BytesUtils.namehash(encodeName('eth'), 0)).to.equal(namehash('eth'))
    })

    it('Hashes a 2LD correctly', async () => {
      expect(await BytesUtils.namehash(encodeName('test.tld'), 0)).to.equal(namehash('test.tld'))
    })

    it('Hashes partial names correctly', async () => {
      expect(await BytesUtils.namehash(encodeName('test.tld'), 5)).to.equal(namehash('tld'))
    })
  })
})
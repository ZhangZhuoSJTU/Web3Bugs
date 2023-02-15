const { constants } = require('hardlydifficult-ethereum-contracts')
const { getProxyAddress } = require('../../../helpers/deployments.js')

const shared = require('./shared')

const Unlock = artifacts.require('Unlock')
const PublicLock = artifacts.require('PublicLock')

contract('Unlock / UnlockProxy', (accounts) => {
  const [unlockOwner] = accounts
  this.accounts = accounts

  beforeEach(async () => {
    this.unlockOwner = unlockOwner

    // get proxy from hardhat deployment
    const chainId = await web3.eth.net.getId()
    this.proxyAddress = getProxyAddress(chainId, 'Unlock')

    // use with truffle
    this.unlock = await Unlock.at(this.proxyAddress)
    const lock = await PublicLock.new()

    await this.unlock.setLockTemplate(lock.address, {
      from: this.unlockOwner,
      gas: constants.MAX_GAS,
    })
  })

  describe('should function as a proxy', () => {
    shared.shouldBehaveLikeV1(this)
  })
})

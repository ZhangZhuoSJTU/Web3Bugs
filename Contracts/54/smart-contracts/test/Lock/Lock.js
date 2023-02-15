const BigNumber = require('bignumber.js')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks

contract('Lock / Lock', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  it('should have created locks with the correct value', async () => {
    const lock = locks.FIRST
    let [
      expirationDuration,
      keyPrice,
      maxNumberOfKeys,
      totalSupply,
      numberOfOwners,
      isAlive,
    ] = await Promise.all([
      lock.expirationDuration.call(),
      lock.keyPrice.call(),
      lock.maxNumberOfKeys.call(),
      lock.totalSupply.call(),
      lock.numberOfOwners.call(),
      lock.isAlive.call(),
    ])
    expirationDuration = new BigNumber(expirationDuration)
    keyPrice = new BigNumber(keyPrice)
    maxNumberOfKeys = new BigNumber(maxNumberOfKeys)
    totalSupply = new BigNumber(totalSupply)
    numberOfOwners = new BigNumber(numberOfOwners)
    assert.equal(expirationDuration.toFixed(), 60 * 60 * 24 * 30)
    assert.strictEqual(web3.utils.fromWei(keyPrice.toFixed(), 'ether'), '0.01')
    assert.equal(maxNumberOfKeys.toFixed(), 10)
    assert.equal(totalSupply.toFixed(), 0)
    assert.equal(numberOfOwners.toFixed(), 0)
    assert.equal(isAlive, true)
  })
})

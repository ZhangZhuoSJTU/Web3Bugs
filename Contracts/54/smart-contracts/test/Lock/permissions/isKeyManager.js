const BigNumber = require('bignumber.js')
const getProxy = require('../../helpers/proxy')
const createLockHash = require('../../helpers/createLockCalldata')

const unlockContract = artifacts.require('Unlock.sol')
const KeyManagerMock = artifacts.require('KeyManagerMock')

let unlock
let lock
let lockCreator
let lockAddress

contract('Permissions / isKeyManager', (accounts) => {
  lockCreator = accounts[0]
  const keyPrice = new BigNumber(web3.utils.toWei('0.01', 'ether'))
  before(async () => {
    unlock = await getProxy(unlockContract)
    await unlock.setLockTemplate((await KeyManagerMock.new()).address)
    const args = [
      60 * 60 * 24 * 30, // 30 days
      web3.utils.padLeft(0, 40),
      web3.utils.toWei('0.01', 'ether'),
      11,
      'KeyManagerMockLock',
    ]

    const calldata = await createLockHash({ args, from: lockCreator })
    let tx = await unlock.createLock(calldata)
    lockAddress = tx.logs[0].args.newLockAddress
    lock = await KeyManagerMock.at(lockAddress)
    await lock.purchase(0, accounts[1], web3.utils.padLeft(0, 40), [], {
      value: keyPrice.toFixed(),
      from: accounts[1],
    })
  })

  describe('confirming the key manager', () => {
    let isKeyManager
    let iD

    it('should return true if address is the KM', async () => {
      iD = await lock.getTokenIdFor.call(accounts[1])
      isKeyManager = await lock.isKeyManager.call(iD, accounts[1], {
        from: accounts[1],
      })
      assert.equal(isKeyManager, true)
      // it shouldn't matter who is calling
      isKeyManager = await lock.isKeyManager.call(iD, accounts[1], {
        from: accounts[5],
      })
      assert.equal(isKeyManager, true)
    })
    it('should return false if address is not the KM', async () => {
      isKeyManager = await lock.isKeyManager.call(iD, accounts[9], {
        from: accounts[1],
      })
      assert.equal(isKeyManager, false)
    })
  })
})

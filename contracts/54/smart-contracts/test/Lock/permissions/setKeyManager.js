const { reverts } = require('truffle-assertions')
const BigNumber = require('bignumber.js')
const { constants } = require('hardlydifficult-ethereum-contracts')
const deployLocks = require('../../helpers/deployLocks')
const getProxy = require('../../helpers/proxy')

const unlockContract = artifacts.require('Unlock.sol')

let unlock
let locks
let lock
let lockCreator

contract('Permissions / KeyManager', (accounts) => {
  lockCreator = accounts[0]
  const lockManager = lockCreator
  const keyPrice = new BigNumber(web3.utils.toWei('0.01', 'ether'))
  let iD
  let keyManager
  let keyManagerBefore

  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, lockCreator)
    lock = locks.FIRST
    await lock.purchase(0, accounts[1], web3.utils.padLeft(0, 40), [], {
      value: keyPrice.toFixed(),
      from: accounts[1],
    })
    iD = await lock.getTokenIdFor(accounts[1])
    await lock.approve(accounts[7], iD, {
      from: accounts[1],
    })
  })

  describe('setting the key manager', () => {
    it('should have a default KM of 0x00', async () => {
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      assert.equal(keyManagerBefore, constants.ZERO_ADDRESS)
    })

    // ensure that by default the owner is also the keyManager
    it('should allow the default keyManager to set a new KM', async () => {
      const defaultKeyManager = accounts[1]
      await lock.setKeyManagerOf(iD, accounts[9], { from: defaultKeyManager })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, accounts[9])
    })

    it('should allow the current keyManager to set a new KM', async () => {
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      await lock.setKeyManagerOf(iD, accounts[3], { from: keyManagerBefore })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, accounts[3])
    })

    it('should allow a LockManager to set a new KM', async () => {
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      await lock.setKeyManagerOf(iD, accounts[5], { from: lockManager })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.notEqual(keyManagerBefore, keyManager)
      assert.equal(keyManager, accounts[5])
    })

    // confirm that approvals are cleared for expired keys
    it('should clear any erc721-approvals for expired keys', async () => {
      const approved = await lock.getApproved(iD)
      assert.equal(approved, 0)
    })

    it('should fail to allow anyone else to set a new KM', async () => {
      await reverts(
        lock.setKeyManagerOf(iD, accounts[2], { from: accounts[6] }),
        'UNAUTHORIZED_KEY_MANAGER_UPDATE'
      )
    })
    describe('setting the KM to 0x00', () => {
      before(async () => {
        iD = await lock.getTokenIdFor(accounts[1])
        keyManager = await lock.keyManagerOf.call(iD)
        await lock.setKeyManagerOf(iD, accounts[9], { from: keyManager })
        keyManager = await lock.keyManagerOf.call(iD)
        assert.equal(keyManager, accounts[9])
        await lock.setKeyManagerOf(iD, constants.ZERO_ADDRESS)
      })

      it('should reset to the default KeyManager of 0x00', async () => {
        keyManager = await lock.keyManagerOf.call(iD)
        assert.equal(keyManager, constants.ZERO_ADDRESS)
      })
    })
  })
})

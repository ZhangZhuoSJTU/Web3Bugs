const { reverts } = require('truffle-assertions')
const BigNumber = require('bignumber.js')
const { constants } = require('hardlydifficult-ethereum-contracts')
const { ethers } = require('hardhat')
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
  const keyGranter = lockCreator
  const keyOwners = [accounts[1], accounts[2], accounts[3]]
  const [keyOwner1, keyOwner2, keyOwner3] = keyOwners
  const keyPrice = new BigNumber(web3.utils.toWei('0.01', 'ether'))
  const oneDay = new BigNumber(60 * 60 * 24)
  let iD
  let keyManagerBefore
  let keyManager

  describe('Key Purchases', () => {
    beforeEach(async () => {
      unlock = await getProxy(unlockContract)
      locks = await deployLocks(unlock, lockCreator)
      lock = locks.FIRST
      const purchases = keyOwners.map((account) => {
        return lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
          value: keyPrice.toFixed(),
          from: account,
        })
      })
      await Promise.all(purchases)
    })

    it('should leave the KM == 0x00(default) for new purchases', async () => {
      iD = await lock.getTokenIdFor(keyOwner1)
      const keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
    })

    it('should not change KM when topping-up valid keys', async () => {
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      await lock.purchase(0, keyOwner1, web3.utils.padLeft(0, 40), [], {
        value: keyPrice.toFixed(),
        from: keyOwner1,
      })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManagerBefore, keyManager)
    })

    it('should reset the KM == 0x00 when renewing expired keys', async () => {
      iD = await lock.getTokenIdFor(keyOwner1)
      await lock.setKeyManagerOf(iD, accounts[9], { from: keyOwner1 })
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      assert.equal(keyManagerBefore, accounts[9])
      await lock.expireAndRefundFor(keyOwner1, 0, { from: lockManager })
      await lock.purchase(0, keyOwner1, web3.utils.padLeft(0, 40), [], {
        value: keyPrice.toFixed(),
        from: keyOwner1,
      })
      assert.notEqual(iD, 0)
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
    })
  })

  describe('Key Transfers', () => {
    before(async () => {
      unlock = await getProxy(unlockContract)
      locks = await deployLocks(unlock, lockCreator)
      lock = locks.FIRST
      const purchases = keyOwners.map((account) => {
        return lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
          value: keyPrice.toFixed(),
          from: account,
        })
      })
      await Promise.all(purchases)
      iD = await lock.getTokenIdFor.call(keyOwner3)
      await lock.setKeyManagerOf(iD, accounts[9], { from: keyOwner3 })
      await lock.expireAndRefundFor(keyOwner3, 0, { from: lockManager })
    })

    it('should leave the KM == 0x00(default) for new recipients', async () => {
      iD = await lock.getTokenIdFor(keyOwner1)
      await lock.transferFrom(keyOwner1, accounts[8], iD, {
        from: keyOwner1,
      })
      iD = await lock.getTokenIdFor(accounts[8])
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
    })

    it('should not change KM for existing valid key owners', async () => {
      let iD8 = await lock.getTokenIdFor(accounts[8])
      iD = await lock.getTokenIdFor(keyOwner2)
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      await lock.transferFrom(accounts[8], keyOwner2, iD8, {
        from: accounts[8],
      })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManagerBefore, keyManager)
    })

    it('should reset the KM to 0x00 for expired key owners', async () => {
      iD = await lock.getTokenIdFor(keyOwner3)
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      assert.equal(keyManagerBefore, accounts[9])
      iD = await lock.getTokenIdFor(keyOwner2)
      await lock.transferFrom(keyOwner2, keyOwner3, iD, {
        from: keyOwner2,
      })
      iD = await lock.getTokenIdFor(keyOwner3)
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
    })
  })

  describe('Key Sharing', () => {
    before(async () => {
      unlock = await getProxy(unlockContract)
      locks = await deployLocks(unlock, lockCreator)
      lock = locks.FIRST
      const purchases = keyOwners.map((account) => {
        return lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
          value: keyPrice.toFixed(),
          from: account,
        })
      })
      await Promise.all(purchases)
      iD = await lock.getTokenIdFor.call(keyOwner3)
      await lock.setKeyManagerOf(iD, accounts[9], { from: keyOwner3 })
      await lock.expireAndRefundFor(keyOwner3, 0, { from: lockManager })
    })

    it('should leave the KM == 0x00(default) for new recipients', async () => {
      iD = await lock.getTokenIdFor(keyOwner1)
      await lock.shareKey(accounts[4], iD, oneDay, {
        from: keyOwner1,
      })
      iD = await lock.getTokenIdFor(accounts[8])
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
    })

    it('should not change KM for existing valid key owners', async () => {
      iD = await lock.getTokenIdFor(keyOwner2)
      keyManagerBefore = await lock.keyManagerOf.call(iD)
      iD = await lock.getTokenIdFor(keyOwner1)
      await lock.shareKey(keyOwner2, iD, oneDay, {
        from: keyOwner1,
      })
      iD = await lock.getTokenIdFor(keyOwner2)
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManagerBefore, keyManager)
    })

    it('should reset the KM to 0x00 for expired key owners', async () => {
      iD = await lock.getTokenIdFor.call(keyOwner1)
      assert.notEqual(iD, 0)
      let keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
      const owner = await lock.ownerOf.call(iD)
      assert.equal(owner, keyOwner1)
      await lock.setKeyManagerOf(iD, accounts[9], { from: keyOwner1 })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, accounts[9])
      await lock.expireAndRefundFor(keyOwner1, 0, { from: lockCreator })
      assert.equal(await lock.getHasValidKey.call(keyOwner1), false)
      iD = await lock.getTokenIdFor(keyOwner2)
      await lock.shareKey(keyOwner1, iD, oneDay, {
        from: keyOwner2,
      })
      iD = await lock.getTokenIdFor(keyOwner1)
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(await lock.getHasValidKey.call(keyOwner1), true)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
    })
  })

  describe('Key Granting', () => {
    let validExpirationTimestamp
    before(async () => {
      const blockNumber = await ethers.provider.getBlockNumber()
      const latestBlock = await ethers.provider.getBlock(blockNumber)
      validExpirationTimestamp = Math.round(latestBlock.timestamp + 600)

      unlock = await getProxy(unlockContract)
      locks = await deployLocks(unlock, lockCreator)
      lock = locks.FIRST
      const purchases = keyOwners.map((account) => {
        return lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
          value: keyPrice.toFixed(),
          from: account,
        })
      })
      await Promise.all(purchases)
      iD = await lock.getTokenIdFor.call(keyOwner3)
      await lock.setKeyManagerOf(iD, accounts[9], { from: keyOwner3 })
      await lock.expireAndRefundFor(keyOwner3, 0, { from: lockManager })
    })

    it('should let KeyGranter set an arbitrary KM for new keys', async () => {
      await lock.grantKeys(
        [accounts[7]],
        [validExpirationTimestamp],
        [accounts[8]],
        {
          from: keyGranter,
        }
      )
      iD = await lock.getTokenIdFor(accounts[7])
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, accounts[8])
    })

    it('should let KeyGranter set an arbitrary KM for existing valid keys', async () => {
      const blockNumber = await ethers.provider.getBlockNumber()
      const latestBlock = await ethers.provider.getBlock(blockNumber)
      const newTimestamp = Math.round(latestBlock.timestamp + 60 * 60 * 24 * 30)
      assert.equal(await lock.getHasValidKey.call(accounts[7]), true)
      await lock.grantKeys([accounts[7]], [newTimestamp], [keyGranter], {
        from: keyGranter,
      })
      iD = await lock.getTokenIdFor(accounts[7])
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, keyGranter)
    })

    it('should let KeyGranter set an arbitrary KM for expired keys', async () => {
      await lock.expireAndRefundFor(accounts[7], 0, { from: lockCreator })
      assert.equal(await lock.getHasValidKey.call(accounts[7]), false)
      const blockNumber = await ethers.provider.getBlockNumber()
      const latestBlock = await ethers.provider.getBlock(blockNumber)
      const newTimestamp = Math.round(latestBlock.timestamp + 60 * 60 * 24 * 30)
      await lock.grantKeys(
        [accounts[7]],
        [newTimestamp],
        [constants.ZERO_ADDRESS],
        {
          from: lockCreator,
        }
      )
      const newKeyManager = await lock.keyManagerOf.call(iD)
      assert.equal(newKeyManager, constants.ZERO_ADDRESS)
    })
  })

  describe('configuring the key manager', () => {
    before(async () => {
      unlock = await getProxy(unlockContract)
      locks = await deployLocks(unlock, lockCreator)
      lock = locks.FIRST
      const purchases = keyOwners.map((account) => {
        return lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
          value: keyPrice.toFixed(),
          from: account,
        })
      })
      await Promise.all(purchases)
      iD = await lock.getTokenIdFor.call(keyOwner3)
      await lock.setKeyManagerOf(iD, accounts[9], { from: keyOwner3 })
      await lock.expireAndRefundFor(keyOwner3, 0, { from: lockManager })
    })

    it('should allow the current keyManager to set a new KM', async () => {
      iD = await lock.getTokenIdFor(keyOwner1)
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, constants.ZERO_ADDRESS)
      await lock.setKeyManagerOf(iD, accounts[9], { from: keyOwner1 })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, accounts[9])
    })

    it('should allow a LockManager to set a new KM', async () => {
      iD = await lock.getTokenIdFor(keyOwner2)
      keyManager = await lock.keyManagerOf.call(iD)
      await lock.setKeyManagerOf(iD, accounts[7], { from: lockManager })
      keyManager = await lock.keyManagerOf.call(iD)
      assert.equal(keyManager, accounts[7])
    })

    it('should fail to allow anyone else to set a new KM', async () => {
      await reverts(
        lock.setKeyManagerOf(iD, accounts[2], { from: accounts[5] }),
        'UNAUTHORIZED_KEY_MANAGER_UPDATE'
      )
    })
  })
})

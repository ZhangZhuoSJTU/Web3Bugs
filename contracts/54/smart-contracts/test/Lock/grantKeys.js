const truffleAssert = require('truffle-assertions')
const { reverts } = require('truffle-assertions')
const { constants } = require('hardlydifficult-ethereum-contracts')

const { ethers } = require('hardhat')
const deployLocks = require('../helpers/deployLocks')

const { errorMessages } = require('../helpers/constants')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let lock
let locks
let tx

const { HARDHAT_VM_ERROR } = errorMessages

contract('Lock / grantKeys', (accounts) => {
  const lockCreator = accounts[1]
  const keyOwner = accounts[2]
  let validExpirationTimestamp

  before(async () => {
    const blockNumber = await ethers.provider.getBlockNumber()
    const latestBlock = await ethers.provider.getBlock(blockNumber)
    validExpirationTimestamp = Math.round(latestBlock.timestamp + 600)
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, lockCreator)
    lock = locks.FIRST
  })

  describe('can grant key(s)', () => {
    describe('can grant a key for a new user', () => {
      before(async () => {
        // the lock creator is assigned the KeyGranter role by default
        tx = await lock.grantKeys(
          [keyOwner],
          [validExpirationTimestamp],
          [constants.ZERO_ADDRESS],
          {
            from: lockCreator,
          }
        )
      })

      it('should log Transfer event', async () => {
        const evt = tx.logs.find((v) => v.event === 'Transfer')
        assert.equal(evt.event, 'Transfer')
        assert.equal(evt.args.from, 0)
        assert.equal(evt.args.to, accounts[2])
      })

      it('should acknowledge that user owns key', async () => {
        assert.notEqual(await lock.getTokenIdFor.call(keyOwner), 0)
      })

      it('getHasValidKey is true', async () => {
        assert.equal(await lock.getHasValidKey.call(keyOwner), true)
      })
    })

    describe('can grant a key extension for an existing user', () => {
      let extendedExpiration

      before(async () => {
        extendedExpiration = validExpirationTimestamp + 100
        tx = await lock.grantKeys(
          [keyOwner],
          [extendedExpiration],
          [constants.ZERO_ADDRESS],
          {
            from: lockCreator,
          }
        )
      })

      it('should log Transfer event', async () => {
        assert.equal(tx.logs[1].event, 'Transfer')
        assert.equal(tx.logs[1].args.from, 0)
        assert.equal(tx.logs[1].args.to, accounts[2])
      })

      it('should acknowledge that user owns key', async () => {
        assert.notEqual(await lock.getTokenIdFor.call(keyOwner), 0)
      })

      it('getHasValidKey is true', async () => {
        assert.equal(await lock.getHasValidKey.call(keyOwner), true)
      })
    })

    describe('bulk grant keys', () => {
      const keyOwnerList = [accounts[3], accounts[4], accounts[5]]

      it('should fail to grant keys when expiration dates are missing', async () => {
        await truffleAssert.fails(
          lock.grantKeys(
            keyOwnerList,
            [validExpirationTimestamp],
            [constants.ZERO_ADDRESS],
            {
              from: lockCreator,
            }
          ),
          `${HARDHAT_VM_ERROR} reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)`
        )
      })
    })

    it('can bulk grant keys using unique expiration dates', async () => {
      const keyOwnerList = [accounts[6], accounts[7]]
      const expirationDates = [
        validExpirationTimestamp,
        validExpirationTimestamp + 42,
      ]

      before(async () => {
        tx = await lock.methods['grantKeys(uint256[],uint256[])'](
          keyOwnerList,
          expirationDates,
          { from: lockCreator }
        )
      })

      it('should acknowledge that user owns key', async () => {
        for (let i = 0; i < keyOwnerList.length; i++) {
          assert.notEqual(await lock.getTokenIdFor.call(keyOwnerList[i]), 0)
        }
      })

      it('getHasValidKey is true', async () => {
        for (let i = 0; i < keyOwnerList.length; i++) {
          assert.equal(await lock.getHasValidKey.call(keyOwnerList[i]), true)
        }
      })
    })
  })

  describe('should fail', () => {
    it('should fail to revoke a key', async () => {
      await reverts(
        lock.grantKeys([keyOwner], [42], [constants.ZERO_ADDRESS], {
          from: lockCreator,
        }),
        'ALREADY_OWNS_KEY'
      )
    })

    it('should fail to grant key to the 0 address', async () => {
      await reverts(
        lock.grantKeys(
          [web3.utils.padLeft(0, 40)],
          [validExpirationTimestamp],
          [constants.ZERO_ADDRESS],
          {
            from: lockCreator,
          }
        ),
        'INVALID_ADDRESS'
      )
    })

    it('should fail to reduce the time remaining on a key', async () => {
      await reverts(
        lock.grantKeys(
          [keyOwner],
          [validExpirationTimestamp - 1],
          [constants.ZERO_ADDRESS],
          {
            from: lockCreator,
          }
        ),
        'ALREADY_OWNS_KEY'
      )
    })

    // By default, the lockCreator has both the LockManager & KeyGranter roles
    it('should fail if called by anyone but LockManager or KeyGranter', async () => {
      await reverts(
        lock.grantKeys(
          [keyOwner],
          [validExpirationTimestamp],
          [constants.ZERO_ADDRESS],
          {
            from: keyOwner,
          }
        )
      )

      await reverts(
        lock.grantKeys(
          [keyOwner],
          [validExpirationTimestamp],
          [constants.ZERO_ADDRESS],
          {
            from: accounts[9],
          }
        )
      )
    })
  })
})

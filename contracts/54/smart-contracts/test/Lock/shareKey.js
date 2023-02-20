const BigNumber = require('bignumber.js')
const { constants } = require('hardlydifficult-ethereum-contracts')
const { reverts } = require('truffle-assertions')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks

contract('Lock / shareKey', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  let lock
  let tokenId1
  let tokenId2
  let event
  let event1
  let event2
  let event3
  let tx1
  let tx2

  const keyOwners = [accounts[1], accounts[2], accounts[3]]
  const keyOwner1 = accounts[1]
  const keyOwner2 = accounts[2]
  const keyOwner3 = accounts[3]
  const accountWithNoKey1 = accounts[4]
  const accountWithNoKey2 = accounts[5]
  const accountWithNoKey3 = accounts[6]
  const approvedAddress = accounts[7]
  const keyPrice = new BigNumber(web3.utils.toWei('0.01', 'ether'))

  before(async () => {
    lock = locks.FIRST
    const purchases = keyOwners.map((account) => {
      return lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
        value: keyPrice.toFixed(),
        from: account,
      })
    })
    await Promise.all(purchases)
  })

  describe('failing to share a key', () => {
    describe('not meeting pre-requisites', () => {
      it('sender is not approved', async () => {
        await reverts(
          lock.shareKey(accounts[7], 11, 1000, {
            from: accountWithNoKey1,
          }),
          'ONLY_KEY_MANAGER_OR_APPROVED'
        )
      })

      it('called by other than keyOwner or approved ', async () => {
        await reverts(
          lock.shareKey(
            accounts[3],
            await lock.getTokenIdFor.call(keyOwners[0]),
            1000,
            {
              from: accounts[6],
            }
          ),
          'ONLY_KEY_MANAGER_OR_APPROVED'
        )
      })

      it('should abort if the recipient is 0x', async () => {
        await reverts(
          lock.shareKey(
            web3.utils.padLeft(0, 40),
            await lock.getTokenIdFor.call(keyOwners[0]),
            1000,
            {
              from: keyOwners[0],
            }
          ),
          'INVALID_ADDRESS'
        )
      })
    })

    it('should fail if trying to share a key with a contract which does not implement onERC721Received', async () => {
      let nonCompliantContract = unlock.address
      let ID = await lock.getTokenIdFor.call(keyOwner2)
      assert.equal(await lock.getHasValidKey.call(keyOwner2), true)
      await reverts(
        lock.shareKey(nonCompliantContract, ID, 1000, {
          from: keyOwner2,
        })
      )
      // make sure the key was not shared
      assert.equal(await lock.getHasValidKey.call(nonCompliantContract), false)
    })

    describe('fallback behaviors', () => {
      it('transfers all remaining time if amount to share >= remaining time', async () => {
        let tooMuchTime = new BigNumber(60 * 60 * 24 * 30 * 2) // 60 days
        tokenId1 = await lock.getTokenIdFor.call(keyOwner1)
        assert.equal(await lock.getHasValidKey.call(keyOwner1), true)
        tx1 = await lock.shareKey(accountWithNoKey1, tokenId1, tooMuchTime, {
          from: keyOwner1,
        })
        let actualTimeShared = tx1.logs[2].args._amount.toNumber(10)
        assert.equal(await lock.getHasValidKey.call(accountWithNoKey1), true) // new owner now has a fresh key
        let newExpirationTimestamp = new BigNumber(
          await lock.keyExpirationTimestampFor.call(accountWithNoKey1)
        )
        let blockTimestampAfter = new BigNumber(
          (await web3.eth.getBlock('latest')).timestamp
        )
        assert(
          newExpirationTimestamp.minus(blockTimestampAfter).eq(actualTimeShared)
        )
      })

      it('should emit the expireKey Event', async () => {
        assert.equal(tx1.logs[0].event, 'ExpireKey')
      })

      it('The origin key is expired', async () => {
        assert.equal(await lock.getHasValidKey.call(keyOwner1), false)
      })

      it('The original owner still owns their key', async () => {
        assert.equal(await lock.ownerOf.call(tokenId1), keyOwner1)
      })
    })
  })
  describe('successful key sharing', () => {
    let oneDay = new BigNumber(60 * 60 * 24)
    let hadKeyBefore
    let expirationBeforeSharing
    let expirationAfterSharing
    let sharedKeyExpiration
    let fee
    let timestampBeforeSharing
    let timestampAfterSharing

    before(async () => {
      // Change the fee to 5%
      await lock.updateTransferFee(500)
      // approve an address
      await lock.approve(approvedAddress, await lock.getTokenIdFor(keyOwner2), {
        from: keyOwner2,
      })

      hadKeyBefore = await lock.getHasValidKey.call(accountWithNoKey2)
      expirationBeforeSharing = new BigNumber(
        await lock.keyExpirationTimestampFor.call(keyOwner2)
      )
      timestampBeforeSharing = new BigNumber(
        (await web3.eth.getBlock('latest')).timestamp
      )
      fee = new BigNumber(await lock.getTransferFee.call(keyOwner2, oneDay))
      tokenId2 = await lock.getTokenIdFor.call(keyOwner2)
      tx2 = await lock.shareKey(accountWithNoKey2, tokenId2, oneDay, {
        from: keyOwner2,
      })
      event = tx2.logs[0].event
      event1 = tx2.logs[1].event
      event2 = tx2.logs[2].event
      event3 = tx2.logs[3].event
    })

    it('should emit the ExpirationChanged event twice', async () => {
      assert.equal(event, 'ExpirationChanged')
      assert.equal(tx2.logs[0].args._timeAdded, false)
      assert.equal(event2, 'ExpirationChanged')
      assert.equal(tx2.logs[2].args._timeAdded, true)
    })

    it('should emit the Transfer event', async () => {
      assert.equal(event1, 'Transfer')
      assert.equal(event3, 'Transfer')
    })

    it('should subtract the time shared + fee from the key owner', async () => {
      expirationAfterSharing = new BigNumber(
        await lock.keyExpirationTimestampFor.call(keyOwner2)
      )
      assert(
        expirationAfterSharing.eq(
          expirationBeforeSharing.minus(fee).minus(oneDay)
        )
      )
    })

    it('should create a new key and add the time shared to it', async () => {
      sharedKeyExpiration = new BigNumber(
        await lock.keyExpirationTimestampFor.call(accountWithNoKey2)
      )
      let currentTimestamp = new BigNumber(
        (await web3.eth.getBlock('latest')).timestamp
      )
      assert.equal(hadKeyBefore, false)
      assert.equal(await lock.getHasValidKey.call(accountWithNoKey2), true)
      assert(sharedKeyExpiration.eq(currentTimestamp.plus(oneDay)))
      assert(
        new BigNumber(await lock.getTokenIdFor.call(keyOwner2)).lt(
          new BigNumber(await lock.getTokenIdFor.call(accountWithNoKey2))
        ) // the tokenId's are not equal
      )
    })

    it('should correctly assign a new id to the new token', async () => {
      let newId = await lock.getTokenIdFor.call(accountWithNoKey2)
      // the tokenId of the new child key should be > the Parent key
      assert(new BigNumber(newId).gt(new BigNumber(tokenId2)))
    })

    it('should not assign the recipient of the granted key as the owner of tokenId 0', async () => {
      const zeroOwner = await lock.ownerOf.call(0)
      assert.equal(zeroOwner, constants.ZERO_ADDRESS)
    })

    it('total time remaining is <= original time + fee', async () => {
      timestampAfterSharing = new BigNumber(
        (await web3.eth.getBlock('latest')).timestamp
      )
      let timeRemainingBefore = expirationBeforeSharing.minus(
        timestampBeforeSharing
      )
      let totalTimeRemainingAfter = expirationAfterSharing
        .minus(timestampAfterSharing)
        .plus(sharedKeyExpiration.minus(timestampAfterSharing))

      assert(timeRemainingBefore.minus(fee).gte(totalTimeRemainingAfter))
    })

    it('should extend the key of an existing owner', async () => {
      let oldExistingKeyExpiration = new BigNumber(
        await lock.keyExpirationTimestampFor.call(keyOwner3)
      )
      await lock.shareKey(keyOwner3, tokenId2, oneDay, {
        from: keyOwner2,
      })
      let newExistingKeyExpiration = new BigNumber(
        await lock.keyExpirationTimestampFor.call(keyOwner3)
      )
      assert(newExistingKeyExpiration.eq(oldExistingKeyExpiration.plus(oneDay)))
    })

    it('should allow an approved address to share a key', async () => {
      let token = new BigNumber(await lock.getTokenIdFor(keyOwner2))
      // make sure recipient does not have a key
      assert.equal(await lock.getHasValidKey.call(accountWithNoKey3), false)
      await lock.shareKey(accountWithNoKey3, token, oneDay, {
        from: approvedAddress,
      })
      // make sure recipient has a key
      assert.equal(await lock.getHasValidKey.call(accountWithNoKey3), true)
      assert(new BigNumber(await lock.getTokenIdFor.call(keyOwner2)).eq(token)) // id has not changed
    })
  })
})

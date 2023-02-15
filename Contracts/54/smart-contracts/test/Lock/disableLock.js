const BigNumber = require('bignumber.js')

const { reverts } = require('truffle-assertions')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks
let ID

const keyPrice = web3.utils.toWei('0.01', 'ether')

contract('Lock / disableLock', (accounts) => {
  let lock
  let keyOwner = accounts[1]
  let keyOwner2 = accounts[2]
  let keyOwner3 = accounts[3]
  let lockOwner = accounts[0]
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, lockOwner)
    lock = locks.FIRST
    await lock.purchase(0, keyOwner, web3.utils.padLeft(0, 40), [], {
      value: keyPrice,
    })
    await lock.purchase(0, keyOwner2, web3.utils.padLeft(0, 40), [], {
      value: keyPrice,
    })
    await lock.purchase(0, keyOwner3, web3.utils.padLeft(0, 40), [], {
      value: keyPrice,
    })
    ID = new BigNumber(await lock.getTokenIdFor(keyOwner)).toFixed()
  })

  it('should fail if called by the wrong account', async () => {
    await reverts(
      lock.disableLock({ from: keyOwner }),
      'MixinRoles: caller does not have the LockManager role'
    )
  })

  describe('when the lock has been disabled', () => {
    let txObj
    let event
    before(async () => {
      txObj = await lock.disableLock({ from: lockOwner })
      event = txObj.logs[0]
    })

    it('should trigger the Disable event', () => {
      assert.equal(event.event, 'Disable')
    })

    it('should fail if called while lock is disabled', async () => {
      await reverts(lock.disableLock(), 'LOCK_DEPRECATED')
    })

    it('should fail if a user tries to purchase a key', async () => {
      await reverts(
        lock.purchase(0, keyOwner, web3.utils.padLeft(0, 40), [], {
          value: keyPrice,
        }),
        'LOCK_DEPRECATED'
      )
    })

    it('should fail if a user tries to purchase a key with a referral', async () => {
      await reverts(
        lock.purchase(0, keyOwner, accounts[3], [], {
          value: keyPrice,
        }),
        'LOCK_DEPRECATED'
      )
    })

    it('should fail if a user tries to transfer a key', async () => {
      await reverts(
        lock.transferFrom(keyOwner, accounts[3], ID, {
          from: keyOwner,
        }),
        'LOCK_DEPRECATED'
      )
    })

    it('should fail if a key owner tries to a approve an address', async () => {
      await reverts(
        lock.approve(accounts[3], ID, {
          from: keyOwner,
        }),
        'LOCK_DEPRECATED'
      )
    })

    it('should still allow access to non-payable contract functions', async () => {
      let HasValidKey = await lock.getHasValidKey.call(keyOwner)
      assert.equal(HasValidKey, true)
    })

    it('Key owners can still cancel for a partial refund', async () => {
      await lock.cancelAndRefund(ID, {
        from: keyOwner,
      })
    })

    it('Lock owners can still fully refund keys', async () => {
      const refundAmount = web3.utils.toWei('0.01', 'ether')
      await lock.expireAndRefundFor(keyOwner3, refundAmount, {
        from: lockOwner,
      })
    })

    it('Lock owner can still withdraw', async () => {
      await lock.withdraw(await lock.tokenAddress.call(), 0)
    })

    it('Lock owner can still expireAndRefundFor', async () => {
      await lock.expireAndRefundFor(keyOwner2, 0)
    })

    it('Lock owner can still updateLockName', async () => {
      await lock.updateLockName('Hardly')
    })

    it('Lock owner can still update refund penalty', async () => {
      await lock.updateRefundPenalty(0, 5000)
    })

    it('should fail to setApprovalForAll', async () => {
      await reverts(
        lock.setApprovalForAll(accounts[3], true, {
          from: keyOwner,
        }),
        'LOCK_DEPRECATED'
      )
    })

    it('should fail to updateKeyPricing', async () => {
      await reverts(
        lock.updateKeyPricing(1, web3.utils.padLeft(0, 40)),
        'LOCK_DEPRECATED'
      )
    })

    it('should fail to safeTransferFrom w/o data', async () => {
      await reverts(
        lock.safeTransferFrom(keyOwner, accounts[3], ID, {
          from: keyOwner,
        }),
        'LOCK_DEPRECATED'
      )
    })

    it('should fail to safeTransferFrom w/ data', async () => {
      await reverts(
        lock.methods['safeTransferFrom(address,address,uint256,bytes)'](
          keyOwner,
          accounts[3],
          ID,
          web3.utils.toHex('Julien'),
          {
            from: keyOwner,
          }
        ),
        'LOCK_DEPRECATED'
      )
    })
  })
})

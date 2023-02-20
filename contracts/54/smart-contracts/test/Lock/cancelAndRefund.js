const BigNumber = require('bignumber.js')

const { reverts } = require('truffle-assertions')
const { constants, tokens } = require('hardlydifficult-ethereum-contracts')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks
let token

contract('Lock / cancelAndRefund', (accounts) => {
  const denominator = 10000

  before(async () => {
    token = await tokens.dai.deploy(web3, accounts[0])
    await token.mint(accounts[0], 100, {
      from: accounts[0],
    })
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  let lock
  const keyOwners = [
    accounts[1],
    accounts[2],
    accounts[3],
    accounts[4],
    accounts[5],
  ]
  const keyPrice = new BigNumber(web3.utils.toWei('0.01', 'ether'))
  const lockCreator = accounts[0]

  before(async () => {
    lock = locks.SECOND
    const purchases = keyOwners.map((account) => {
      return lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
        value: keyPrice.toFixed(),
        from: account,
      })
    })
    await Promise.all(purchases)
  })

  it('should return the correct penalty', async () => {
    const numerator = new BigNumber(await lock.refundPenaltyBasisPoints.call())
    assert.equal(numerator.div(denominator).toFixed(), 0.1) // default of 10%
  })

  it('the amount of refund should be less than the original keyPrice when purchased normally', async () => {
    const estimatedRefund = new BigNumber(
      await lock.getCancelAndRefundValueFor.call(keyOwners[0])
    )
    assert(estimatedRefund.lt(keyPrice))
  })

  it('the amount of refund should be less than the original keyPrice when expiration is very far in the future', async () => {
    await lock.grantKeys(
      [accounts[5]],
      [999999999999],
      [constants.ZERO_ADDRESS],
      {
        from: accounts[0],
      }
    )
    const estimatedRefund = new BigNumber(
      await lock.getCancelAndRefundValueFor.call(accounts[5])
    )
    assert(estimatedRefund.lt(keyPrice))
  })

  it('the estimated refund for a free Key should be 0', async () => {
    await locks.FREE.grantKeys(
      [accounts[5]],
      [999999999999],
      [constants.ZERO_ADDRESS],
      {
        from: accounts[0],
      }
    )
    const estimatedRefund = new BigNumber(
      await locks.FREE.getCancelAndRefundValueFor.call(accounts[5])
    )
    assert(estimatedRefund, 0)
  })

  describe('should cancel and refund when enough time remains', () => {
    let initialLockBalance
    let initialKeyOwnerBalance
    let estimatedRefund
    let txObj
    let withdrawalAmount

    before(async () => {
      initialLockBalance = new BigNumber(
        await web3.eth.getBalance(lock.address)
      )
      initialKeyOwnerBalance = new BigNumber(
        await web3.eth.getBalance(keyOwners[0])
      )
      estimatedRefund = new BigNumber(
        await lock.getCancelAndRefundValueFor.call(keyOwners[0])
      )
      const iD = await lock.getTokenIdFor(keyOwners[0])
      txObj = await lock.cancelAndRefund(iD, {
        from: keyOwners[0],
      })
      withdrawalAmount = new BigNumber(
        await web3.eth.getBalance(lock.address)
      ).minus(initialLockBalance)
    })

    it('should emit a CancelKey event', async () => {
      assert.equal(txObj.logs[0].event, 'CancelKey')
    })

    it('the amount of refund should be greater than 0', async () => {
      const refund = new BigNumber(txObj.logs[0].args.refund)
      assert(refund.gt(0))
    })

    it('the amount of refund should be less than or equal to the original key price', async () => {
      const refund = new BigNumber(txObj.logs[0].args.refund)
      assert(refund.lt(keyPrice))
    })

    it('the amount of refund should be less than or equal to the estimated refund', async () => {
      const refund = new BigNumber(txObj.logs[0].args.refund)
      assert(refund.lte(estimatedRefund))
    })

    it('should make the key no longer valid (i.e. expired)', async () => {
      const isValid = await lock.getHasValidKey.call(keyOwners[0])
      assert.equal(isValid, false)
    })

    it("should increase the owner's balance with the amount of funds withdrawn from the lock", async () => {
      const txHash = await web3.eth.getTransaction(txObj.tx)
      const gasUsed = new BigNumber(txObj.receipt.gasUsed)
      const gasPrice = new BigNumber(txHash.gasPrice)
      const txFee = gasPrice.times(gasUsed)
      const finalOwnerBalance = new BigNumber(
        await web3.eth.getBalance(keyOwners[0])
      )
      assert(
        finalOwnerBalance.toFixed(),
        initialKeyOwnerBalance.plus(withdrawalAmount).minus(txFee).toFixed()
      )
    })
  })

  it('can cancel a free key', async () => {
    await locks.FREE.grantKeys(
      [accounts[1]],
      [999999999999],
      [constants.ZERO_ADDRESS],
      {
        from: accounts[0],
      }
    )
    const iD = await locks.FREE.getTokenIdFor(accounts[1])
    const txObj = await locks.FREE.cancelAndRefund(iD, {
      from: accounts[1],
    })
    assert.equal(txObj.logs[0].event, 'CancelKey')
  })

  it('approved user can cancel a key', async () => {
    await locks.FREE.grantKeys(
      [accounts[1]],
      [999999999999],
      [constants.ZERO_ADDRESS],
      {
        from: accounts[0],
      }
    )
    const iD = await locks.FREE.getTokenIdFor(accounts[1])
    await locks.FREE.approve(accounts[9], iD, { from: accounts[1] })
    const txObj = await locks.FREE.cancelAndRefund(iD, {
      from: accounts[9],
    })
    assert.equal(txObj.logs[0].event, 'CancelKey')
  })

  describe('allows the Lock owner to specify a different cancellation penalty', () => {
    let tx

    before(async () => {
      tx = await lock.updateRefundPenalty(0, 2000) // 20%
    })

    it('should trigger an event', async () => {
      const event = tx.logs.find((log) => {
        return log.event === 'RefundPenaltyChanged'
      })
      assert.equal(
        new BigNumber(event.args.refundPenaltyBasisPoints).toFixed(),
        2000
      )
    })

    it('should return the correct penalty', async () => {
      const numerator = new BigNumber(
        await lock.refundPenaltyBasisPoints.call()
      )
      assert.equal(numerator.div(denominator).toFixed(), 0.2) // updated to 20%
    })

    it('should still allow refund', async () => {
      const iD = await lock.getTokenIdFor(keyOwners[2])
      const txObj = await lock.cancelAndRefund(iD, {
        from: keyOwners[2],
      })
      const refund = new BigNumber(txObj.logs[0].args.refund)
      assert(refund.gt(0))
    })
  })

  describe('should fail when', () => {
    let iD

    it('should fail if the Lock owner withdraws too much funds', async () => {
      await lock.withdraw(await lock.tokenAddress.call(), 0, {
        from: lockCreator,
      })
      iD = await lock.getTokenIdFor(keyOwners[3])
      await reverts(
        lock.cancelAndRefund(iD, {
          from: keyOwners[3],
        }),
        ''
      )
    })

    it('non-managers should fail to update the fee', async () => {
      await reverts(
        lock.updateRefundPenalty(0, 0, { from: accounts[1] }),
        'MixinRoles: caller does not have the LockManager role'
      )
    })

    it('the key is expired', async () => {
      await lock.expireAndRefundFor(keyOwners[3], 0, {
        from: lockCreator,
      })
      iD = await lock.getTokenIdFor(keyOwners[3])
      await reverts(
        lock.cancelAndRefund(iD, {
          from: keyOwners[3],
        }),
        'KEY_NOT_VALID'
      )
    })

    it('the owner does not have a key', async () => {
      iD = await lock.getTokenIdFor(accounts[7])
      await reverts(
        lock.cancelAndRefund(iD, {
          from: accounts[7],
        }),
        'ONLY_KEY_MANAGER'
      )
    })
  })

  it('should refund in the new token after token address is changed', async () => {
    // Confirm user has a key paid in eth
    assert.equal(await lock.getHasValidKey.call(accounts[5]), true)
    assert.equal(await lock.tokenAddress.call(), 0)
    // check user's token balance
    assert.equal(await token.balanceOf(accounts[5]), 0)
    // update token address and price
    await lock.updateKeyPricing(11, token.address, {
      from: lockCreator,
    })
    // fund lock with new erc20 tokens to deal enable refunds
    await token.mint(lock.address, 100, {
      from: accounts[0],
    })
    assert.equal(await token.balanceOf(lock.address), 100)
    const iD = await lock.getTokenIdFor(accounts[5])
    // cancel and refund
    await lock.cancelAndRefund(iD, { from: accounts[5] })
    // check user's token balance
    assert(new BigNumber(await token.balanceOf(accounts[5])).gt(0))
  })
})

const BigNumber = require('bignumber.js')

const { tokens } = require('hardlydifficult-ethereum-contracts')
const { reverts } = require('truffle-assertions')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks
let lock
let keyPriceBefore
let tokenAddressBefore
let transaction
let token
let lockCreator
let invalidTokenAddress

contract('Lock / updateKeyPricing', (accounts) => {
  invalidTokenAddress = accounts[9]
  lockCreator = accounts[0]

  before(async () => {
    token = await tokens.dai.deploy(web3, accounts[0])
    // Mint some tokens so that the totalSupply is greater than 0
    await token.mint(accounts[0], 1, {
      from: accounts[0],
    })
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
    lock = locks.FIRST
    keyPriceBefore = new BigNumber(await lock.keyPrice.call())
    tokenAddressBefore = await lock.tokenAddress.call()
    assert.equal(keyPriceBefore.toFixed(), 10000000000000000)
    transaction = await lock.updateKeyPricing(
      web3.utils.toWei('0.3', 'ether'),
      token.address,
      { from: lockCreator }
    )
  })

  it('should assign the owner to the LockManagerRole by default', async () => {
    assert.equal(await lock.isLockManager(lockCreator), true)
  })

  it('should change the actual keyPrice', async () => {
    const keyPriceAfter = new BigNumber(await lock.keyPrice.call())
    assert.equal(keyPriceAfter.toFixed(), 300000000000000000)
  })

  it('should trigger an event', () => {
    const event = transaction.logs.find((log) => {
      return log.event === 'PricingChanged'
    })
    assert(event)
    assert.equal(
      new BigNumber(event.args.keyPrice).toFixed(),
      300000000000000000
    )
  })

  it('should allow changing price to 0', async () => {
    await lock.updateKeyPricing(0, await lock.tokenAddress.call())
    const keyPriceAfter = new BigNumber(await lock.keyPrice.call())
    assert.equal(keyPriceAfter.toFixed(), 0)
  })

  describe('when the sender does not have the LockManager role', () => {
    let keyPrice

    before(async () => {
      keyPrice = new BigNumber(await lock.keyPrice.call())
      await reverts(
        lock.updateKeyPricing(
          web3.utils.toWei('0.3', 'ether'),
          await lock.tokenAddress.call(),
          {
            from: accounts[3],
          }
        ),
        ''
      )
    })

    it('should leave the price unchanged', async () => {
      const keyPriceAfter = new BigNumber(await lock.keyPrice.call())
      assert.equal(keyPrice.toFixed(), keyPriceAfter.toFixed())
    })

    it('should fail to let anyone but a lockManager add another lockManager', async () => {
      // first we try an account which is not a lockManager
      assert.equal(await lock.isLockManager(accounts[8]), false)
      await reverts(
        lock.addLockManager(accounts[7], {
          from: accounts[8],
        }),
        'MixinRoles: caller does not have the LockManager role'
      )
    })
  })

  describe('changing the token address', () => {
    it('should allow a LockManager to switch from eth => erc20', async () => {
      assert.equal(tokenAddressBefore, 0)
      assert.equal(await lock.isLockManager(lockCreator), true)
      await lock.updateKeyPricing(await lock.keyPrice.call(), token.address, {
        from: lockCreator,
      })
      let tokenAddressAfter = await lock.tokenAddress.call()
      assert.equal(tokenAddressAfter, token.address)
    })

    it('should allow a LockManager to switch from erc20 => eth', async () => {
      await lock.updateKeyPricing(
        await lock.keyPrice.call(),
        web3.utils.padLeft(0, 40)
      )
      assert.equal(await lock.tokenAddress.call(), 0)
    })

    it('should allow a lock manager who is not the owner to make changes', async () => {
      await lock.addLockManager(accounts[8], { from: lockCreator })
      assert.notEqual(accounts[8], lockCreator)
      assert.equal(await lock.isLockManager(accounts[8]), true)
      await lock.updateKeyPricing(
        web3.utils.toWei('0.42', 'ether'),
        token.address,
        { from: accounts[8] }
      )
      assert.equal(await lock.tokenAddress.call(), token.address)
      assert.equal(
        await lock.keyPrice.call(),
        web3.utils.toWei('0.42', 'ether')
      )
    })

    it('should allow a lockManager to renounce their role', async () => {
      await lock.renounceLockManager({ from: accounts[8] })
      assert.equal(await lock.isLockManager(accounts[8]), false)
    })

    it('should revert if trying to switch to an invalid token address', async () => {
      await reverts(
        lock.updateKeyPricing(await lock.keyPrice.call(), invalidTokenAddress, {
          from: lockCreator,
        })
      )
    })
  })
})

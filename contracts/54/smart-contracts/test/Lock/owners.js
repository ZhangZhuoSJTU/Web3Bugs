const BigNumber = require('bignumber.js')

const truffleAssert = require('truffle-assertions')
const { reverts } = require('truffle-assertions')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let lock
let locks
let unlock

contract('Lock / owners', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
    lock = locks.FIRST
    await lock.updateTransferFee(0) // disable the transfer fee for this test
  })

  before(() => {
    // Purchase keys!
    return Promise.all([
      lock.purchase(0, accounts[1], web3.utils.padLeft(0, 40), [], {
        value: lock.params.keyPrice.toFixed(),
        from: accounts[0],
      }),
      lock.purchase(0, accounts[2], web3.utils.padLeft(0, 40), [], {
        value: lock.params.keyPrice.toFixed(),
        from: accounts[0],
      }),
      lock.purchase(0, accounts[3], web3.utils.padLeft(0, 40), [], {
        value: lock.params.keyPrice.toFixed(),
        from: accounts[0],
      }),
      lock.purchase(0, accounts[4], web3.utils.padLeft(0, 40), [], {
        value: lock.params.keyPrice.toFixed(),
        from: accounts[0],
      }),
    ])
  })

  it('should have the right number of keys', async () => {
    const totalSupply = new BigNumber(await lock.totalSupply.call())
    assert.equal(totalSupply.toFixed(), 4)
  })

  it('should have the right number of owners', async () => {
    const numberOfOwners = new BigNumber(await lock.numberOfOwners.call())
    assert.equal(numberOfOwners.toFixed(), 4)
  })

  it('should allow for access to an individual key owner', async () => {
    const owners = await Promise.all([
      lock.owners.call(0),
      lock.owners.call(1),
      lock.owners.call(2),
      lock.owners.call(3),
    ])

    assert.deepEqual(owners.sort(), accounts.slice(1, 5).sort())
  })

  it('should fail to access to an individual key owner when out of bounds', async () => {
    await truffleAssert.fails(
      lock.owners.call(6),
      'Transaction reverted without a reason string'
    )
  })

  describe('after a transfer to a new address', () => {
    let numberOfOwners

    before(async () => {
      numberOfOwners = new BigNumber(await lock.numberOfOwners.call())
      let ID = await lock.getTokenIdFor.call(accounts[1])
      await lock.transferFrom(accounts[1], accounts[5], ID, {
        from: accounts[1],
      })
    })

    it('should have the right number of keys', async () => {
      const totalSupply = new BigNumber(await lock.totalSupply.call())
      assert.equal(totalSupply.toFixed(), 4)
    })

    it('should have the right number of owners', async () => {
      const _numberOfOwners = new BigNumber(await lock.numberOfOwners.call())
      assert.equal(_numberOfOwners.toFixed(), numberOfOwners.plus(1))
    })

    it('should fail if I transfer from the same account again', async () => {
      await reverts(
        lock.transferFrom(accounts[1], accounts[5], accounts[1], {
          from: accounts[1],
        }),
        'KEY_NOT_VALID'
      )
    })
  })

  describe('after a transfer to an existing owner', () => {
    let numberOfOwners

    before(async () => {
      numberOfOwners = new BigNumber(await lock.numberOfOwners.call())
      let ID = await lock.getTokenIdFor.call(accounts[2])
      await lock.transferFrom(accounts[2], accounts[3], ID, {
        from: accounts[2],
      })
    })

    it('should have the right number of keys', async () => {
      const totalSupply = new BigNumber(await lock.totalSupply.call())
      assert.equal(totalSupply.toFixed(), 4)
    })

    it('should have the right number of owners', async () => {
      const _numberOfOwners = new BigNumber(await lock.numberOfOwners.call())
      assert.equal(_numberOfOwners.toFixed(), numberOfOwners.toFixed())
    })
  })
})

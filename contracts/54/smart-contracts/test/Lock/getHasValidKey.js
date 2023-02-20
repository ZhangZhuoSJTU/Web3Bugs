const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks

contract('Lock / getHasValidKey', (accounts) => {
  const account = accounts[1]
  let lock

  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
    lock = locks.FIRST
    await lock.updateTransferFee(0) // disable the transfer fee for this test
  })

  it('should be false before purchasing a key', async () => {
    const isValid = await lock.getHasValidKey.call(account)
    assert.equal(isValid, false)
  })

  describe('after purchase', () => {
    before(async () => {
      await lock.purchase(0, account, web3.utils.padLeft(0, 40), [], {
        value: web3.utils.toWei('0.01', 'ether'),
      })
    })

    it('should be true', async () => {
      const isValid = await lock.getHasValidKey.call(account)
      assert.equal(isValid, true)
    })

    describe('after transfering a previously purchased key', () => {
      before(async () => {
        await lock.transferFrom(
          account,
          accounts[5],
          await lock.getTokenIdFor.call(account),
          { from: account }
        )
      })

      it('should be false', async () => {
        const isValid = await lock.getHasValidKey.call(account)
        assert.equal(isValid, false)
      })
    })
  })
})

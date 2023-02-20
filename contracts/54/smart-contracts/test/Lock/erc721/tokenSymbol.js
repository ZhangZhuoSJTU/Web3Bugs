const { reverts } = require('truffle-assertions')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let lock
let txObj
let event

contract('Lock / erc721 / tokenSymbol', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)

    const locks = await deployLocks(unlock, accounts[0])
    lock = locks.FIRST
  })

  describe('the global token symbol stored in Unlock', () => {
    it('should return the global token symbol', async () => {
      assert.equal(await unlock.globalTokenSymbol.call(), '')
    })

    describe('set the global symbol', () => {
      beforeEach(async () => {
        txObj = await unlock.configUnlock(
          await unlock.udt(),
          await unlock.weth(),
          0,
          'KEY',
          await unlock.globalBaseTokenURI(),
          1, // mainnet
          {
            from: accounts[0],
          }
        )
        event = txObj.logs[0]
      })

      it('should allow the owner to set the global token Symbol', async () => {
        assert.equal(await unlock.globalTokenSymbol.call(), 'KEY')
      })

      it('getGlobalTokenSymbol is the same', async () => {
        assert.equal(
          await unlock.globalTokenSymbol.call(),
          await unlock.getGlobalTokenSymbol.call()
        )
      })

      it('should emit the ConfigUnlock event', async () => {
        assert.equal(event.event, 'ConfigUnlock')
      })
    })

    it('should fail if someone other than the owner tries to set the symbol', async () => {
      await reverts(
        unlock.configUnlock(
          await unlock.udt(),
          await unlock.weth(),
          0,
          'BTC',
          await unlock.globalBaseTokenURI(),
          1, // mainnet
          {
            from: accounts[1],
          }
        )
      )
    })
  })

  describe('A custom token symbol stored in the lock', () => {
    it('should allow the lock owner to set a custom token symbol', async () => {
      txObj = await lock.updateLockSymbol('MYTKN', { from: accounts[0] })
      event = txObj.logs[0]
      assert.equal(await lock.symbol.call(), 'MYTKN')
    })

    it('should fail if someone other than the owner tries to set the symbol', async () => {
      await reverts(
        lock.updateLockSymbol('BTC', {
          from: accounts[1],
        }),
        'MixinRoles: caller does not have the LockManager role'
      )
    })

    it('should emit the NewLockSymbol event', async () => {
      assert.equal(event.event, 'NewLockSymbol')
    })
  })
})

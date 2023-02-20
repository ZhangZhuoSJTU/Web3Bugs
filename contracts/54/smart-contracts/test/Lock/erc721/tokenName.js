const { reverts } = require('truffle-assertions')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let unnamedlock
let namedLock

contract('Lock / erc721 / name', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    const locks = await deployLocks(unlock, accounts[0])
    unnamedlock = locks.FIRST
    namedLock = locks.NAMED
  })

  describe('when no name has been set on creation', () => {
    it('should return the default name when attempting to read the name', async () => {
      assert.equal(await unnamedlock.name.call(), 'Unlock-Protocol Lock')
    })

    it('should fail if someone other than the owner tries to set the name', async () => {
      await reverts(
        unnamedlock.updateLockName('Hardly', {
          from: accounts[1],
        }),
        'MixinRoles: caller does not have the LockManager role'
      )
    })

    it('should allow the owner to set a name', async () => {
      await unnamedlock.updateLockName('Hardly', {
        from: accounts[0],
      })
    })
  })

  describe('when the Lock has a name', () => {
    it('should return return the expected name', async () => {
      assert.equal(await namedLock.name.call(), 'Custom Named Lock')
    })

    it('should fail if someone other than the owner tries to change the name', async () => {
      await reverts(
        namedLock.updateLockName('Difficult', {
          from: accounts[1],
        })
      )
    })

    describe('should allow the owner to set a name', () => {
      before(async () => {
        await namedLock.updateLockName('Difficult', {
          from: accounts[0],
        })
      })

      it('should return return the expected name', async () => {
        assert.equal(await namedLock.name.call(), 'Difficult')
      })
    })

    describe('should allow the owner to unset the name', () => {
      before(async () => {
        await namedLock.updateLockName('', {
          from: accounts[0],
        })
      })

      it('should return return the expected name', async () => {
        assert.equal(await namedLock.name.call(), '')
      })
    })
  })
})

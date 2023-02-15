const { reverts } = require('truffle-assertions')

const unlockContract = artifacts.require('Unlock.sol')
const PublicLock = artifacts.require('PublicLock')
const getProxy = require('../helpers/proxy')

let unlock
let lockTemplate
let unlockOwner

contract('Lock / setLockTemplate', (accounts) => {
  beforeEach(async () => {
    unlock = await getProxy(unlockContract)
    lockTemplate = await PublicLock.new()
    unlockOwner = accounts[0]
  })

  describe('configuring the Unlock contract', () => {
    it('should let the owner configure the Unlock contract', async () => {
      await unlock.setLockTemplate(lockTemplate.address, {
        from: unlockOwner,
      })
    })

    it('should revert if the template was already initialized', async () => {
      await lockTemplate.initialize(
        accounts[0],
        0,
        web3.utils.padLeft(0, 40),
        0,
        0,
        ''
      )
      await reverts(
        unlock.setLockTemplate(lockTemplate.address, {
          from: unlockOwner,
        })
      )
    })

    it('should revert if called by other than the owner', async () => {
      await reverts(
        unlock.setLockTemplate(lockTemplate.address, {
          from: accounts[7],
        }),
        'Ownable: caller is not the owner'
      )
    })

    it('should revert if the lock template address is not a contract', async () => {
      await reverts(
        unlock.setLockTemplate(accounts[7], {
          from: unlockOwner,
        })
      )
    })
  })
})

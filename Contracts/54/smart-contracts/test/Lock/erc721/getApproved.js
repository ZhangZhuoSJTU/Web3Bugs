const { reverts } = require('truffle-assertions')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let locks

contract('Lock / erc721 / getApproved', (accounts) => {
  before(async () => {
    this.unlock = await getProxy(unlockContract)
    locks = await deployLocks(this.unlock, accounts[0])
  })

  it('should fail if the key does not exist', async () => {
    await reverts(locks.FIRST.getApproved.call(42), 'NO_SUCH_KEY')
  })
})

const unlockContract = artifacts.require('Unlock.sol')

const { reverts } = require('truffle-assertions')
const getProxy = require('../helpers/proxy')
const { errorMessages } = require('../helpers/constants')

const { VM_ERROR_REVERT_WITH_REASON } = errorMessages

let unlock

contract('Unlock / initializers', (accounts) => {
  beforeEach(async () => {
    unlock = await getProxy(unlockContract)
  })

  it('There is only 1 public initializer in Unlock', async () => {
    const count = unlockContract.abi.filter(
      (x) => x.name.toLowerCase() === 'initialize'
    ).length
    assert.equal(count, 1)
  })

  it('initialize may not be called again', async () => {
    await reverts(
      unlock.initialize(accounts[0]),
      `${VM_ERROR_REVERT_WITH_REASON} 'Initializable: contract is already initialized'`
    )
  })
})

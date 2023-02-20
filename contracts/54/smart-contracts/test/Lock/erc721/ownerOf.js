const { constants } = require('hardlydifficult-ethereum-contracts')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let locks

contract('Lock / erc721 / ownerOf', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  it('should return 0x0 when key is nonexistent', async () => {
    let address = await locks.FIRST.ownerOf.call(42)
    assert.equal(address, constants.ZERO_ADDRESS)
  })

  it('should return the owner of the key', async () => {
    await locks.FIRST.purchase(0, accounts[1], web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from: accounts[1],
    })
    const ID = await locks.FIRST.getTokenIdFor.call(accounts[1])
    let address = await locks.FIRST.ownerOf.call(ID)
    assert.equal(address, accounts[1])
  })
})

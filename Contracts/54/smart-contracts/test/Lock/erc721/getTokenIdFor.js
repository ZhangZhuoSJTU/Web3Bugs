const BigNumber = require('bignumber.js')

const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let locks

contract('Lock / erc721 / getTokenIdFor', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  it('returns 0 when the address is not a keyOwner', async () => {
    const id = await locks.FIRST.getTokenIdFor.call(accounts[3])
    assert.equal(id, 0)
  })

  it("should return the tokenId for the owner's key", async () => {
    await locks.FIRST.purchase(0, accounts[1], web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from: accounts[1],
    })
    let ID = new BigNumber(await locks.FIRST.getTokenIdFor.call(accounts[1]))
    // Note that as we implement ERC721 support, the tokenId will no longer
    // be the same as the user's address
    assert(ID.eq(1))
  })
})

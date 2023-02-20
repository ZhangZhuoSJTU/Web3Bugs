const { reverts } = require('truffle-assertions')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let lock

contract('Lock / erc721 / safeTransferFrom', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    const locks = await deployLocks(unlock, accounts[0])
    lock = locks.FIRST
    await lock.updateTransferFee(0) // disable the transfer fee for this test
  })

  // function safeTransferFrom() still uses transferFrom() under the hood, but adds an additional check afterwards. transferFrom is already well-tested, so here we add a few checks to test only the new functionality.
  const from = accounts[1]
  const to = accounts[2]
  let ID

  before(async () => {
    // first, let's purchase a brand new key that we can transfer
    await lock.purchase(0, from, web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from,
    })
    ID = await lock.getTokenIdFor.call(from)
  })

  it('should work if no data is passed in', async () => {
    await lock.safeTransferFrom(from, to, ID, {
      from,
    })
    let ownerOf = await lock.ownerOf.call(ID)
    assert.equal(ownerOf, to)
  })

  it('should work if some data is passed in', async () => {
    await lock.purchase(0, accounts[7], web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from: accounts[7],
    })
    ID = await lock.getTokenIdFor.call(accounts[7])
    const method = 'safeTransferFrom(address,address,uint256,bytes)'
    await lock.methods[method](
      accounts[7],
      accounts[6],
      ID,
      web3.utils.toHex('Julien'),
      {
        from: accounts[7],
      }
    )
    let ownerOf = await lock.ownerOf.call(ID)
    assert.equal(ownerOf, accounts[6])
    // while we may pass data to the safeTransferFrom function, it is not currently utilized in any way other than being passed to the `onERC721Received` function in MixinTransfer.sol
  })

  it('should fail if trying to transfer a key to a contract which does not implement onERC721Received', async () => {
    await lock.purchase(0, accounts[5], web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from: accounts[5],
    })
    ID = await lock.getTokenIdFor.call(accounts[5])
    // A contract which does NOT implement onERC721Received:
    let nonCompliantContract = unlock.address
    await reverts(
      lock.safeTransferFrom(accounts[5], nonCompliantContract, ID, {
        from: accounts[5],
      })
    )
    // make sure the key was not transferred
    let ownerOf = await lock.ownerOf.call(ID)
    assert.equal(ownerOf, accounts[5])
  })
})

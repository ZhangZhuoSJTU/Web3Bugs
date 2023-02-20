const BigNumber = require('bignumber.js')

const { reverts } = require('truffle-assertions')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let locks

contract('Lock / erc721 / balanceOf', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  it('should fail if the user address is 0', async () => {
    await reverts(
      locks.FIRST.balanceOf.call(web3.utils.padLeft(0, 40)),
      'INVALID_ADDRESS'
    )
  })

  it('should return 0 if the user has no key', async () => {
    const balance = new BigNumber(await locks.FIRST.balanceOf.call(accounts[3]))
    assert.equal(balance.toFixed(), 0)
  })

  it('should return 1 if the user has a non expired key', async () => {
    await locks.FIRST.purchase(0, accounts[1], web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from: accounts[1],
    })
    const balance = new BigNumber(await locks.FIRST.balanceOf.call(accounts[1]))
    assert.equal(balance.toFixed(), 1)
  })

  it('should return 0 if the user has an expired key', async () => {
    await locks.FIRST.purchase(0, accounts[5], web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from: accounts[5],
    })
    await locks.FIRST.expireAndRefundFor(accounts[5], 0, {
      from: accounts[0],
    })
    const balance = new BigNumber(await locks.FIRST.balanceOf.call(accounts[5]))
    assert.equal(balance.toFixed(), 0)
  })

  it('should return 0 after a user transfers their key', async () => {
    await locks.FIRST.purchase(0, accounts[6], web3.utils.padLeft(0, 40), [], {
      value: web3.utils.toWei('0.01', 'ether'),
      from: accounts[6],
    })
    let ID = await locks.FIRST.getTokenIdFor.call(accounts[6])
    await locks.FIRST.transferFrom(accounts[6], accounts[5], ID, {
      from: accounts[6],
    })
    let balanceOf6 = await locks.FIRST.balanceOf.call(accounts[6])
    let balanceOf5 = await locks.FIRST.balanceOf.call(accounts[5])
    assert.equal(balanceOf6, 0)
    assert.equal(balanceOf5, 1)
  })
})

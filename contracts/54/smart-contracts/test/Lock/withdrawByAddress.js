const BigNumber = require('bignumber.js')
const { tokens } = require('hardlydifficult-ethereum-contracts')

const { reverts } = require('truffle-assertions')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let lock
let token

contract('Lock / withdrawByAddress', (accounts) => {
  let owner = accounts[0]

  before(async () => {
    unlock = await getProxy(unlockContract)
    const locks = await deployLocks(unlock, owner)
    lock = locks.OWNED

    // Put some ERC-20 tokens into the contract
    token = await tokens.dai.deploy(web3, owner)
    await token.mint(lock.address, 42000, {
      from: owner,
    })
  })

  describe('when the owner withdraws funds for a specific token', () => {
    let ownerBalance
    let contractBalance

    before(async () => {
      ownerBalance = new BigNumber(await token.balanceOf(owner))
      contractBalance = new BigNumber(await token.balanceOf(lock.address))
      await lock.withdraw(token.address, 0, {
        from: owner,
      })
    })

    it("should set the lock's balance to 0", async () => {
      assert.equal(await token.balanceOf(lock.address), 0)
    })

    it("should increase the owner's balance with the funds from the lock", async () => {
      const balance = new BigNumber(await token.balanceOf(owner))
      assert.equal(
        balance.toString(),
        ownerBalance.plus(contractBalance).toString()
      )
    })

    it('should fail if there is nothing left to withdraw', async () => {
      await reverts(
        lock.withdraw(token.address, 0, {
          from: owner,
        }),
        'NOT_ENOUGH_FUNDS'
      )
    })
  })
})

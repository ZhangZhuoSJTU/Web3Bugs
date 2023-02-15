const { reverts } = require('truffle-assertions')
const { tokens } = require('hardlydifficult-eth')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks

contract('Lock / approveBeneficiary', (accounts) => {
  const [daiOwner, beneficiary, keyOwner, spender, other] = accounts

  before(async () => {
    unlock = await getProxy(unlockContract)
  })

  describe('ETH', () => {
    before(async () => {
      locks = await deployLocks(unlock, beneficiary)
    })

    it('fails to approve if the lock is priced in ETH', async () => {
      await reverts(
        locks.OWNED.approveBeneficiary(accounts[0], 1, { from: beneficiary })
      )
    })
  })

  describe('ERC20', () => {
    let token

    before(async () => {
      token = await tokens.dai.deploy(web3, daiOwner)
      await token.mint(keyOwner, web3.utils.toWei('100', 'ether'), {
        from: daiOwner,
      })
      locks = await deployLocks(unlock, beneficiary, token.address)

      await token.approve(locks.ERC20.address, await locks.ERC20.keyPrice(), {
        from: keyOwner,
      })
      await locks.ERC20.purchase(
        await locks.ERC20.keyPrice(),
        keyOwner,
        web3.utils.padLeft(0, 40),
        [],
        {
          from: keyOwner,
        }
      )

      await locks.ERC20.approveBeneficiary(spender, 1, { from: beneficiary })
    })

    it('approve fails if called from the wrong account', async () => {
      await reverts(
        locks.OWNED.approveBeneficiary(accounts[0], 1, { from: other }),
        'ONLY_LOCK_MANAGER_OR_BENEFICIARY'
      )
    })

    it('has allowance', async () => {
      const actual = await token.allowance(locks.ERC20.address, spender)
      assert.equal(actual.toString(), 1)
    })

    it('can transferFrom', async () => {
      await token.transferFrom(locks.ERC20.address, other, 1, {
        from: spender,
      })
    })
  })
})

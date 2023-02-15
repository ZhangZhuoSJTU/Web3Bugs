// The test run will repeat for each of these lock fixtures individually
const lockTypes = ['FIRST', 'ERC20', 'FREE']

const { tokens } = require('hardlydifficult-ethereum-contracts')
const deployLocks = require('../../helpers/deployLocks')
const getProxy = require('../../helpers/proxy')

const unlockContract = artifacts.require('Unlock.sol')

contract('Lock / lockBehaviors', (accounts) => {
  beforeEach(async () => {
    this.accounts = accounts

    this.unlock = await getProxy(unlockContract)
    this.testToken = await tokens.sai.deploy(web3, accounts[0])
    // Mint some tokens for testing
    for (let i = 0; i < accounts.length; i++) {
      await this.testToken.mint(accounts[i], '1000000000000000000', {
        from: accounts[0],
      })
    }

    this.locks = await deployLocks(
      this.unlock,
      accounts[0],
      this.testToken.address
    )
  })

  lockTypes.forEach((lockType) => {
    describe(`Test lock fixture: '${lockType}'`, () => {
      beforeEach(async () => {
        this.lock = this.locks[lockType]

        // approve spending (ignored if the test pass does not use ERC-20)
        for (let i = 0; i < accounts.length; i++) {
          await this.testToken.approve(
            this.lock.address,
            await this.lock.keyPrice.call(),
            {
              from: accounts[i],
            }
          )
        }
      })
    })
  })
})

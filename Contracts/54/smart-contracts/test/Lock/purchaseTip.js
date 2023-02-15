const truffleAssert = require('truffle-assertions')
const BigNumber = require('bignumber.js')
const { tokens } = require('hardlydifficult-ethereum-contracts')
const deployLocks = require('../helpers/deployLocks')
const getProxy = require('../helpers/proxy')

const unlockContract = artifacts.require('Unlock.sol')
const Erc20Token = artifacts.require('IERC20.sol')

const scenarios = [false, true]
let unlock
let locks
let testToken
const keyPrice = web3.utils.toWei('0.01', 'ether')
const tip = new BigNumber(keyPrice).plus(web3.utils.toWei('1', 'ether'))

contract('Lock / purchaseTip', (accounts) => {
  scenarios.forEach((isErc20, i) => {
    let lock
    let tokenAddress

    if (i === 1) return

    describe(`Test ${isErc20 ? 'ERC20' : 'ETH'}`, () => {
      beforeEach(async () => {
        testToken = await tokens.dai.deploy(web3, accounts[0])
        // Mint some tokens for testing
        await testToken.mint(accounts[2], '100000000000000000000', {
          from: accounts[0],
        })

        tokenAddress = isErc20 ? testToken.address : web3.utils.padLeft(0, 40)

        unlock = await getProxy(unlockContract)
        locks = await deployLocks(unlock, accounts[0], tokenAddress)
        lock = locks.FIRST

        // Approve spending
        await testToken.approve(lock.address, tip, {
          from: accounts[2],
        })
      })

      describe('purchase with exact value specified', () => {
        beforeEach(async () => {
          await lock.purchase(
            keyPrice.toString(),
            accounts[2],
            web3.utils.padLeft(0, 40),
            [],
            {
              from: accounts[2],
              value: isErc20 ? 0 : keyPrice.toString(),
            }
          )
        })

        it('user sent keyPrice to the contract', async () => {
          const balance = isErc20
            ? await Erc20Token.at(tokenAddress).balanceOf(lock.address)
            : await web3.eth.getBalance(lock.address)
          assert.equal(balance.toString(), keyPrice.toString())
        })
      })

      describe('purchase with tip', () => {
        beforeEach(async () => {
          await lock.purchase(
            tip.toString(),
            accounts[2],
            web3.utils.padLeft(0, 40),
            [],
            {
              from: accounts[2],
              value: isErc20 ? 0 : tip.toString(),
            }
          )
        })

        it('user sent the tip to the contract', async () => {
          const balance = isErc20
            ? await Erc20Token.at(tokenAddress).balanceOf(lock.address)
            : await web3.eth.getBalance(lock.address)
          assert.notEqual(balance.toString(), keyPrice.toString())
          assert.equal(balance.toString(), tip.toString())
        })
      })

      describe('purchase with ETH tip > value specified', () => {
        beforeEach(async () => {
          await lock.purchase(
            keyPrice.toString(),
            accounts[2],
            web3.utils.padLeft(0, 40),
            [],
            {
              from: accounts[2],
              value: isErc20 ? 0 : tip.toString(),
            }
          )
        })

        it('user sent tip to the contract if ETH (else send keyPrice)', async () => {
          const balance = isErc20
            ? await Erc20Token.at(tokenAddress).balanceOf(lock.address)
            : await web3.eth.getBalance(lock.address)
          if (!isErc20) {
            assert.equal(balance.toString(), tip.toString())
          } else {
            assert.equal(balance.toString(), keyPrice.toString())
          }
        })
      })

      if (!isErc20) {
        describe('purchase with unspecified ETH tip', () => {
          beforeEach(async () => {
            await lock.purchase(0, accounts[2], web3.utils.padLeft(0, 40), [], {
              from: accounts[2],
              value: isErc20 ? 0 : tip.toString(),
            })
          })

          it('user sent tip to the contract if ETH (else send keyPrice)', async () => {
            const balance = isErc20
              ? await Erc20Token.at(tokenAddress).balanceOf(lock.address)
              : await web3.eth.getBalance(lock.address)
            if (!isErc20) {
              assert.equal(balance.toString(), tip.toString())
            } else {
              assert.equal(balance.toString(), keyPrice.toString())
            }
          })
        })
      }

      if (isErc20) {
        it('should fail if value is less than keyPrice', async () => {
          await truffleAssert.fails(
            lock.purchase(1, accounts[2], web3.utils.padLeft(0, 40), [], {
              from: accounts[2],
              value: isErc20 ? 0 : keyPrice.toString(),
            }),
            'revert',
            'INSUFFICIENT_VALUE'
          )
        })
      }
    })
  })
})

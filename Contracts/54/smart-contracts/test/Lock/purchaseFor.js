const BigNumber = require('bignumber.js')

const { reverts } = require('truffle-assertions')
const { ethers } = require('hardhat')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

let unlock
let locks

contract('Lock / purchaseFor', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  describe('when the contract has a public key release', () => {
    it('should fail if the price is not enough', async () => {
      await reverts(
        locks.FIRST.purchase(0, accounts[0], web3.utils.padLeft(0, 40), [], {
          value: web3.utils.toWei('0.0001', 'ether'),
        }),
        'INSUFFICIENT_VALUE'
      )
      // Making sure we do not have a key set!
      assert.equal(
        await locks.FIRST.keyExpirationTimestampFor.call(accounts[0]),
        0
      )
    })

    it('should fail if we reached the max number of keys', async () => {
      await locks['SINGLE KEY'].purchase(
        0,
        accounts[0],
        web3.utils.padLeft(0, 40),
        [],
        {
          value: web3.utils.toWei('0.01', 'ether'),
        }
      )
      await reverts(
        locks['SINGLE KEY'].purchase(
          0,
          accounts[1],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
            from: accounts[1],
          }
        ),
        'LOCK_SOLD_OUT'
      )
    })

    it('should trigger an event when successful', async () => {
      const tx = await locks.FIRST.purchase(
        0,
        accounts[2],
        web3.utils.padLeft(0, 40),
        [],
        {
          value: web3.utils.toWei('0.01', 'ether'),
        }
      )
      assert.equal(tx.logs[0].event, 'Transfer')
      assert.equal(tx.logs[0].args.from, 0)
      assert.equal(tx.logs[0].args.to, accounts[2])
      // Verify that RenewKeyPurchase does not emit on a first key purchase
      const includes = tx.logs.filter((l) => l.event === 'RenewKeyPurchase')
      assert.equal(includes.length, 0)
    })

    describe('when the user already owns an expired key', () => {
      it('should expand the validity by the default key duration', async () => {
        await locks.SECOND.purchase(
          0,
          accounts[4],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
          }
        )
        // let's now expire the key
        await locks.SECOND.expireAndRefundFor(accounts[4], 0)

        // Purchase a new one
        const newKeyTx = await locks.SECOND.purchase(
          0,
          accounts[4],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
          }
        )

        const transferBlock = await ethers.provider.getBlock(
          newKeyTx.receipt.blockNumber
        )
        const transferTs = transferBlock.timestamp

        // And check the expiration which shiuld be exactly now + keyDuration
        const expirationTimestamp = new BigNumber(
          await locks.SECOND.keyExpirationTimestampFor.call(accounts[4])
        )
        assert.equal(
          expirationTimestamp.minus(transferTs).toNumber(),
          locks.SECOND.params.expirationDuration.toNumber()
        )
      })
    })

    describe('when the user already owns a non expired key', () => {
      let tx2
      let firstExpiration

      it('should expand the validity by the default key duration', async () => {
        await locks.FIRST.purchase(
          0,
          accounts[1],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
          }
        )
        firstExpiration = new BigNumber(
          await locks.FIRST.keyExpirationTimestampFor.call(accounts[1])
        )
        assert(firstExpiration.gt(0))
        tx2 = await locks.FIRST.purchase(
          0,
          accounts[1],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
          }
        )
        const expirationTimestamp = new BigNumber(
          await locks.FIRST.keyExpirationTimestampFor.call(accounts[1])
        )
        assert.equal(
          expirationTimestamp.toFixed(),
          firstExpiration.plus(locks.FIRST.params.expirationDuration).toFixed()
        )
      })

      it('should emit the RenewKeyPurchase event', async () => {
        let expirationDuration = new BigNumber(
          await locks.FIRST.expirationDuration.call()
        )
        assert.equal(tx2.logs[0].event, 'RenewKeyPurchase')
        assert.equal(tx2.logs[0].args.owner, accounts[1])
        assert(
          new BigNumber(tx2.logs[0].args.newExpiration).eq(
            firstExpiration.plus(expirationDuration)
          )
        )
        // Verify that Transfer does not emit on a key renewal
        const included = tx2.logs.filter((l) => l.event === 'Transfer')
        assert.equal(included.length, 0)
      })
    })

    describe('when the key was successfuly purchased', () => {
      let totalSupply
      let numberOfOwners
      let balance
      let now

      before(async () => {
        balance = new BigNumber(await web3.eth.getBalance(locks.FIRST.address))
        totalSupply = new BigNumber(await locks.FIRST.totalSupply.call())
        now = parseInt(new Date().getTime() / 1000)
        numberOfOwners = new BigNumber(await locks.FIRST.numberOfOwners.call())
        return locks.FIRST.purchase(
          0,
          accounts[0],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
          }
        )
      })

      it('should have the right expiration timestamp for the key', async () => {
        const expirationTimestamp = new BigNumber(
          await locks.FIRST.keyExpirationTimestampFor.call(accounts[0])
        )
        const expirationDuration = new BigNumber(
          await locks.FIRST.expirationDuration.call()
        )
        assert(expirationTimestamp.gte(expirationDuration.plus(now)))
      })

      it('should have added the funds to the contract', async () => {
        let newBalance = new BigNumber(
          await web3.eth.getBalance(locks.FIRST.address)
        )
        assert.equal(
          parseFloat(web3.utils.fromWei(newBalance.toFixed(), 'ether')),
          parseFloat(web3.utils.fromWei(balance.toFixed(), 'ether')) + 0.01
        )
      })

      it('should have increased the number of outstanding keys', async () => {
        const _totalSupply = new BigNumber(await locks.FIRST.totalSupply.call())
        assert.equal(_totalSupply.toFixed(), totalSupply.plus(1).toFixed())
      })

      it('should have increased the number of owners', async () => {
        const _numberOfOwners = new BigNumber(
          await locks.FIRST.numberOfOwners.call()
        )
        assert.equal(
          _numberOfOwners.toFixed(),
          numberOfOwners.plus(1).toFixed()
        )
      })
    })

    it('can purchase a free key', async () => {
      const tx = await locks.FREE.purchase(
        0,
        accounts[2],
        web3.utils.padLeft(0, 40),
        []
      )
      assert.equal(tx.logs[0].event, 'Transfer')
      assert.equal(tx.logs[0].args.from, 0)
      assert.equal(tx.logs[0].args.to, accounts[2])
    })

    describe('can re-purchase an expired key', () => {
      let tx

      before(async () => {
        await locks.SHORT.purchase(
          0,
          accounts[4],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
          }
        )
        // let's now expire the key
        await locks.SHORT.expireAndRefundFor(accounts[4], 0)
        // sleep 10 seconds
        await sleep(10000)
      })

      it('should expand the validity by the default key duration', async () => {
        // Purchase a new one
        tx = await locks.SHORT.purchase(
          0,
          accounts[4],
          web3.utils.padLeft(0, 40),
          [],
          {
            value: web3.utils.toWei('0.01', 'ether'),
          }
        )

        const transferBlock = await ethers.provider.getBlock(
          tx.receipt.blockNumber
        )
        const transferTs = transferBlock.timestamp

        // And check the expiration which shiuld be exactly now + keyDuration
        const expirationTimestamp = new BigNumber(
          await locks.SHORT.keyExpirationTimestampFor.call(accounts[4])
        )

        assert.equal(
          expirationTimestamp.minus(transferTs).toNumber(),
          locks.SHORT.params.expirationDuration.toNumber()
        )
      })

      it('should emit the RenewKeyPurchase event', async () => {
        let duration = new BigNumber(
          await locks.SHORT.expirationDuration.call()
        )

        assert.equal(tx.logs[0].event, 'RenewKeyPurchase')
        assert.equal(tx.logs[0].args.owner, accounts[4])

        const transferBlock = await ethers.provider.getBlock(
          tx.receipt.blockNumber
        )
        const transferTs = transferBlock.timestamp
        assert.equal(
          new BigNumber(tx.logs[0].args.newExpiration).toNumber(),
          duration.plus(transferTs).toNumber()
        )

        // Verify that Transfer does not emit on an expired key re-purchase
        const included = tx.logs.filter((l) => l.event === 'Transfer')
        assert.equal(included.length, 0)
      })
    })
  })
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const { reverts } = require('truffle-assertions')
const createLockHash = require('../../helpers/createLockCalldata')

const PublicLock = artifacts.require('PublicLock')

exports.shouldCreateLock = (options) => {
  describe('Unlock / behaviors / createLock', () => {
    let unlock
    let accounts
    let evt

    beforeEach(async () => {
      ;({ unlock, accounts } = options)
    })

    describe('lock created successfully', () => {
      let transaction
      beforeEach(async () => {
        const args = [
          60 * 60 * 24 * 30, // expirationDuration: 30 days
          web3.utils.padLeft(0, 40),
          web3.utils.toWei('1', 'ether'), // keyPrice: in wei
          100, // maxNumberOfKeys
          'New Lock',
        ]
        const calldata = await createLockHash({ args, from: accounts[0] })
        transaction = await unlock.createLock(calldata, { gas: 6000000 })
        evt = transaction.logs.find((v) => v.event === 'NewLock')
      })

      it('should have kept track of the Lock inside Unlock with the right balances', async () => {
        let publicLock = await PublicLock.at(evt.args.newLockAddress)
        // This is a bit of a dumb test because when the lock is missing, the value are 0 anyway...
        let results = await unlock.locks(publicLock.address)
        assert.equal(results.totalSales, 0)
        assert.equal(results.yieldedDiscountTokens, 0)
      })

      it('should trigger the NewLock event', () => {
        const event = transaction.logs.find((v) => v.event === 'NewLock')
        assert(event)
        assert.equal(
          web3.utils.toChecksumAddress(event.args.lockOwner),
          web3.utils.toChecksumAddress(accounts[0])
        )
        assert(event.args.newLockAddress)
      })

      it('should have created the lock with the right address for unlock', async () => {
        let publicLock = await PublicLock.at(evt.args.newLockAddress)
        let unlockProtocol = await publicLock.unlockProtocol.call()
        assert.equal(
          web3.utils.toChecksumAddress(unlockProtocol),
          web3.utils.toChecksumAddress(unlock.address)
        )
      })
    })

    describe('lock creation fails', () => {
      it('should fail if expirationDuration is too large', async () => {
        const args = [
          60 * 60 * 24 * 365 * 101, // expirationDuration: 101 years
          web3.utils.padLeft(0, 40),
          web3.utils.toWei('1', 'ether'), // keyPrice: in wei
          100, // maxNumberOfKeys
          'Too Big Expiration Lock',
        ]
        const calldata = await createLockHash({ args, from: accounts[0] })
        reverts(
          unlock.createLock(calldata, {
            gas: 4000000,
          })
        )
      })
    })
  })
}

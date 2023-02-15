const PublicLock = artifacts.require('PublicLock')
const createLockHash = require('./createLockCalldata')
const Locks = require('../fixtures/locks')

module.exports = async function deployLocks(
  unlock,
  from,
  tokenAddress = web3.utils.padLeft(0, 40)
) {
  let locks = {}
  await Promise.all(
    Object.keys(Locks).map(async (name) => {
      const args = [
        Locks[name].expirationDuration.toFixed(),
        tokenAddress,
        Locks[name].keyPrice.toFixed(),
        Locks[name].maxNumberOfKeys.toFixed(),
        Locks[name].lockName,
      ]
      const calldata = await createLockHash({ args, from })
      const tx = await unlock.createLock(calldata)
      const evt = tx.logs.find((v) => v.event === 'NewLock')
      const lock = await PublicLock.at(evt.args.newLockAddress)
      locks[name] = lock
      locks[name].params = Locks[name]
    })
  )
  return locks
}

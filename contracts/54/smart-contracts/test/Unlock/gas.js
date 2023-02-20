const BigNumber = require('bignumber.js')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')
const WalletService = require('../helpers/walletServiceMock.js')
const createLockHash = require('../helpers/createLockCalldata')

let unlock

contract('Unlock / gas', (accounts) => {
  let createLockGas = new BigNumber(42)

  beforeEach(async () => {
    unlock = await getProxy(unlockContract)
    const args = [
      60 * 60 * 24 * 30, // expirationDuration: 30 days
      web3.utils.padLeft(0, 40),
      web3.utils.toWei('1', 'ether'), // keyPrice: in wei
      100, // maxNumberOfKeys
      'Gas Test Lock',
    ]
    const calldata = await createLockHash({ args, from: accounts[0] })
    let tx = await unlock.createLock(calldata)
    createLockGas = new BigNumber(tx.receipt.gasUsed)
  })

  it('gas used to createLock is less than wallet service limit', async () => {
    if (!process.env.TEST_COVERAGE) {
      assert(createLockGas.lte(WalletService.gasAmountConstants().createLock))
    }
  })
})

const BigNumber = require('bignumber.js')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')
const WalletService = require('../helpers/walletServiceMock.js')

let unlock
let lock

contract('Lock / gas', (accounts) => {
  beforeEach(async () => {
    unlock = await getProxy(unlockContract)
    const locks = await deployLocks(unlock, accounts[0])
    lock = locks.FIRST
  })

  it('gas used to purchaseFor is less than wallet service limit', async () => {
    let tx = await lock.purchase(
      0,
      accounts[0],
      web3.utils.padLeft(0, 40),
      [],
      {
        value: web3.utils.toWei('0.01', 'ether'),
      }
    )
    const gasUsed = new BigNumber(tx.receipt.gasUsed)
    if (!process.env.TEST_COVERAGE) {
      assert(gasUsed.lte(WalletService.gasAmountConstants().purchaseKey))
    }
  })
})

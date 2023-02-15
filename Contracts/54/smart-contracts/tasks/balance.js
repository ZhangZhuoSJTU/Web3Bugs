const { task } = require('hardhat/config')

task('balance', "Prints an account's ETH balance")
  .addParam('account', "The account's address")
  .setAction(async (taskArgs) => {
    const account = web3.utils.toChecksumAddress(taskArgs.account)
    const balance = await web3.eth.getBalance(account)
    // eslint-disable-next-line no-console
    console.log(web3.utils.fromWei(balance, 'ether'), 'ETH')
  })

task('balance:udt', "Prints an account's UDT balance")
  .addParam('account', "The account's address")
  .setAction(async ({ account }) => {
    // eslint-disable-next-line global-require
    const udtBalance = require('../scripts/getters/udt-balance')
    await udtBalance({ account })
  })

task('balance:votes', "Prints an account's UDT Gov voting power")
  .addParam('account', "The account's address")
  .setAction(async ({ account }) => {
    // eslint-disable-next-line global-require
    const udtVotes = require('../scripts/getters/udt-votes')
    await udtVotes({ account })
  })

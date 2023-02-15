const { task } = require('hardhat/config')

task('gnosis:create', 'Create a Gnosis safe from a list of owners')
  .addVariadicPositionalParam('owners', 'addresses of the owners')
  .addOptionalParam('threshold', 'threshold for majority vote', '1')
  .setAction(async ({ owners, threshold }) => {
    // eslint-disable-next-line global-require
    const gnosisDeployer = require('../scripts/multisig/create')
    return await gnosisDeployer({ owners, threshold })
  })

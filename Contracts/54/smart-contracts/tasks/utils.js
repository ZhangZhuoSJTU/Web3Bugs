const { task } = require('hardhat/config')

task('node:reset', 'Reser node state').setAction(async () => {
  // eslint-disable-next-line global-require
  const { resetNodeState } = require('../test/helpers/mainnet')
  await resetNodeState()
  // eslint-disable-next-line no-console
  console.log('Node state reset OK.')
})

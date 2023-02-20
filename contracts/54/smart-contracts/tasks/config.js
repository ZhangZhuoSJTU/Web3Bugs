const { task } = require('hardhat/config')

task('config', 'Show current config')
  .addFlag('json', 'output as JSON')
  .setAction(({ json }, { config }) => {
    // eslint-disable-next-line no-console
    console.log(json ? JSON.stringify(config) : config)
  })

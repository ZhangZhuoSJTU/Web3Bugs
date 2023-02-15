const { task, run } = require('hardhat/config')
const { getNetworkName } = require('../helpers/network')

task('set', 'Various setters for Unlock contracts')
  .addOptionalParam(
    'unlockAddress',
    'the address of an existing Unlock contract'
  )
  .addOptionalParam('udtAddress', 'the address of an existing UDT contract')
  .addOptionalParam('wethAddress', 'the address of the WETH token contract')
  .addOptionalParam(
    'oracleAddress',
    'the address of the Uniswap Oracle contract'
  )
  .addOptionalParam(
    'publicLockAddress',
    'the address of an existing public Lock contract'
  )
  .addOptionalParam('estimatedGasForPurchase', 'gas estimate for buying a key')
  .addOptionalParam('locksmithURI', 'the locksmith URL to use in Unlock config')
  .setAction(
    async (
      {
        publicLockAddress,
        unlockAddress,
        udtAddress,
        wethAddress,
        estimatedGasForPurchase,
        locksmithURI,
        oracleAddress,
      },
      { ethers }
    ) => {
      const { chainId } = await ethers.provider.getNetwork()
      const networkName = process.env.RUN_MAINNET_FORK
        ? 'mainnet'
        : getNetworkName(chainId)

      // eslint-disable-next-line no-console
      console.log(`Connecting to ${networkName}...`)

      run('set:template', {
        publicLockAddress,
        unlockAddress,
      })

      run('set:unlock-config', {
        unlockAddress,
        udtAddress,
        wethAddress,
        estimatedGasForPurchase,
        locksmithURI,
      })

      run('set:unlock-oracle', {
        unlockAddress,
        udtAddress,
        oracleAddress,
      })
    }
  )

task('set:template', 'Set PublicLock address in Unlock contract')
  .addOptionalParam(
    'unlockAddress',
    'the address of an existing Unlock contract'
  )
  .addOptionalParam(
    'publicLockAddress',
    'the address of an existing public Lock contract'
  )
  .setAction(async ({ publicLockAddress, unlockAddress }) => {
    // eslint-disable-next-line global-require
    const templateSetter = require('../scripts/setters/set-template')
    await templateSetter({
      publicLockAddress,
      unlockAddress,
    })
  })

task('set:unlock-config', 'Configure Unlock contract')
  .addOptionalParam(
    'unlockAddress',
    'the address of an existing Unlock contract'
  )
  .addOptionalParam(
    'publicLockAddress',
    'the address of an existing public Lock contract'
  )
  .addOptionalParam('wethAddress', 'the address of the WETH token contract')
  .addOptionalParam('estimatedGasForPurchase', 'gas estimate for buying a key')
  .addOptionalParam('locksmithURI', 'the locksmith URL to use in Unlock config')
  .setAction(
    async ({
      unlockAddress,
      udtAddress,
      wethAddress,
      estimatedGasForPurchase,
      locksmithURI,
    }) => {
      // eslint-disable-next-line global-require
      const unlockConfigSetter = require('../scripts/setters/unlock-config')
      await unlockConfigSetter({
        unlockAddress,
        udtAddress,
        wethAddress,
        estimatedGasForPurchase,
        locksmithURI,
      })
    }
  )

task('set:unlock-oracle', 'Set UDT <> WETH oracle address in Unlock contract')
  .addOptionalParam(
    'unlockAddress',
    'the address of an existing Unlock contract'
  )
  .addOptionalParam('udtAddress', 'the address of an existing UDT contract')
  .addOptionalParam(
    'oracleAddress',
    'the address of the Uniswap Oracle contract'
  )
  .setAction(async ({ unlockAddress, udtAddress, oracleAddress }) => {
    // eslint-disable-next-line global-require
    const unlockOracleSetter = require('../scripts/setters/unlock-oracle')
    await unlockOracleSetter({
      unlockAddress,
      udtAddress,
      oracleAddress,
    })
  })

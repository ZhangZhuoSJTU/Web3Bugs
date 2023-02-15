const { task } = require('hardhat/config')
const { getNetworkName } = require('../helpers/network')

task('deploy', 'Deploy the entire Unlock protocol')
  .addOptionalParam(
    'unlockAddress',
    'the address of an existing Unlock contract'
  )
  .addOptionalParam('udtAddress', 'the address of an existing UDT contract')
  .addOptionalParam(
    'publicLockAddress',
    'the address of an existing public Lock contract'
  )
  .addOptionalParam('wethAddress', 'the address of the WETH token contract')
  .addOptionalParam(
    'uniswapFactoryAddress',
    'the address of an existing Uniswap V2 Factory contract'
  )
  .addOptionalParam(
    'uniswapRouterAddress',
    'the address of an existing Uniswap V2 Router contract'
  )
  .addOptionalParam(
    'oracleAddress',
    'the address of an existing Uniswap Oracle contract'
  )
  .addOptionalParam(
    'premintAmount',
    'the amount of tokens to be pre-minted when originating UDT'
  )
  .addOptionalParam(
    'liquidity',
    'the amount of liquidity to be added to the WETH<>UDT pool'
  )
  .addOptionalParam('estimatedGasForPurchase', 'gas estimate for buying a key')
  .addOptionalParam('locksmithURI', 'the URL locksmith to use in Unlock config')
  .addFlag('setTemplate', 'set the PublicLock instance in Unlock')
  .setAction(
    async (
      {
        unlockAddress,
        udtAddress,
        publicLockAddress,
        wethAddress,
        uniswapFactoryAddress,
        oracleAddress,
        premintAmount,
        liquidity,
        setTemplate,
        estimatedGasForPurchase,
        locksmithURI,
        uniswapRouterAddress,
      },
      { ethers }
    ) => {
      const { chainId } = await ethers.provider.getNetwork()
      const networkName = process.env.RUN_MAINNET_FORK
        ? 'mainnet'
        : getNetworkName(chainId)

      // eslint-disable-next-line no-console
      console.log(`Starting deployments on ${networkName}...`)

      // eslint-disable-next-line global-require
      const mainDeployer = require('../scripts/deployments')
      await mainDeployer({
        unlockAddress,
        udtAddress,
        publicLockAddress,
        wethAddress,
        uniswapRouterAddress,
        uniswapFactoryAddress,
        oracleAddress,
        premintAmount,
        liquidity,
        setTemplate,
        estimatedGasForPurchase,
        locksmithURI,
      })
    }
  )

task('deploy:udt', 'Deploy Unlock Discount Token proxy').setAction(async () => {
  // eslint-disable-next-line global-require
  const udtDeployer = require('../scripts/deployments/udt')
  return await udtDeployer()
})

task('deploy:unlock', 'Deploy Unlock proxy').setAction(async () => {
  // eslint-disable-next-line global-require
  const unlockDeployer = require('../scripts/deployments/unlock')
  return await unlockDeployer()
})

task('deploy:weth', 'Deploy WETH contract').setAction(async () => {
  // eslint-disable-next-line global-require
  const wethDeployer = require('../scripts/deployments/weth')
  return await wethDeployer()
})

task('deploy:uniswap', 'Deploy Uniswap V2 Factory and Router')
  .addOptionalParam('wethAddress', 'the address of the WETH token contract')
  .setAction(async ({ wethAddress }) => {
    // eslint-disable-next-line global-require
    const uniswapDeployer = require('../scripts/deployments/uniswap-v2')
    return await uniswapDeployer({ wethAddress })
  })

task('deploy:oracle', 'Deploy UDT <> WETH oracle contract')
  .addOptionalParam(
    'uniswapFactoryAddress',
    'the address of an existing Uniswap V2 Factory contract'
  )
  .setAction(async ({ uniswapFactoryAddress }) => {
    // eslint-disable-next-line global-require
    const oracleDeployer = require('../scripts/deployments/oracle')
    return await oracleDeployer({ uniswapFactoryAddress })
  })

task('deploy:template', 'Deploy PublicLock contract').setAction(async () => {
  // eslint-disable-next-line global-require
  const templateDeployer = require('../scripts/deployments/template')
  return await templateDeployer()
})

task('deploy:governor', 'Deploy Governor Alpha contracts').setAction(
  async () => {
    // eslint-disable-next-line global-require
    const govDeployer = require('../scripts/deployments/governor')
    return await govDeployer()
  }
)

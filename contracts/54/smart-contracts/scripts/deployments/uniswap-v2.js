const { ethers } = require('hardhat')
const UniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const UniswapV2Router02 = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')

const log = (...message) => {
  // eslint-disable-next-line no-console
  console.log('UNISWAP/WETH SETUP >', ...message)
}

async function main({ wethAddress }) {
  if (!wethAddress) {
    throw new Error('Missing WETH... aborting')
  }

  log(`Using WETH contract at: ${wethAddress}`)

  const [deployer] = await ethers.getSigners()
  const deployerAddress = deployer.address
  log(`Deploying Uniswap contracts using ${deployerAddress}`)

  // Deploy Factory
  const Factory = await ethers.getContractFactory(
    UniswapV2Factory.abi,
    UniswapV2Factory.bytecode
  )
  const factory = await Factory.deploy(deployerAddress)
  await factory.deployed()

  log(
    `Uniswap V2 Factory deployed to : ${factory.address} (tx: ${factory.deployTransaction.hash})`
  )

  // Deploy Router passing Factory Address and WETH Address
  const Router = await ethers.getContractFactory(
    UniswapV2Router02.abi,
    UniswapV2Router02.bytecode
  )
  const router = await Router.deploy(factory.address, wethAddress)
  await router.deployed()

  log(
    `Router V02 deployed to :  ${router.address} (tx: ${router.deployTransaction.hash})`
  )

  return {
    weth: wethAddress,
    factory: factory.address,
    router: router.address,
  }
}

// execute as standalone
if (require.main === module) {
  /* eslint-disable promise/prefer-await-to-then, no-console */
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = main

const { ethers } = require('hardhat')
const UniswapOracle = require('hardlydifficult-eth/build/contracts/UniswapOracle.json')

// TODO: check if oracle has already been deployed and skips if one already exists!
async function main({ uniswapFactoryAddress }) {
  if (!uniswapFactoryAddress) {
    // eslint-disable-next-line no-console
    throw new Error(
      'UNISWAP ORACLE > Missing Uniswap V2 Factory address... aborting.'
    )
  }
  const Oracle = await ethers.getContractFactory(
    UniswapOracle.abi,
    UniswapOracle.bytecode
  )
  const oracle = await Oracle.deploy(uniswapFactoryAddress)
  await oracle.deployed()

  // eslint-disable-next-line no-console
  console.log(
    'UNISWAP ORACLE > Oracle deployed at:',
    oracle.address,
    ` (tx: ${oracle.deployTransaction.hash})`
  )

  return oracle.address
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

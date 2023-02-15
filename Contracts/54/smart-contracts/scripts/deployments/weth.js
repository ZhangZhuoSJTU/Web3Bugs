const { ethers } = require('hardhat')
const WETH = require('hardlydifficult-eth/src/tokens/weth.json')

async function main() {
  const Weth = await ethers.getContractFactory(WETH.abi, WETH.bytecode)
  const weth = await Weth.deploy()
  await weth.deployed()

  // eslint-disable-next-line no-console
  console.log(
    `WETH > deployed to : ${weth.address} (tx: ${weth.deployTransaction.hash}`
  )
  return weth.address
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

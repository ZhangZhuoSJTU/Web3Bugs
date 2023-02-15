const { ethers, upgrades } = require('hardhat')

// used to update contract implementation address in proxy admin using multisig
async function main({ proxyAddress, contractName }) {
  const Contract = await ethers.getContractFactory(contractName)
  const implementation = await upgrades.prepareUpgrade(proxyAddress, Contract)

  // eslint-disable-next-line no-console
  console.log(`${contractName} implementation deployed at: ${implementation}`)

  return implementation
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

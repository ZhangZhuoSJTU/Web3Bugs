const { ethers, upgrades } = require('hardhat')
const { addDeployment } = require('../../helpers/deployments')

async function main() {
  const [deployer] = await ethers.getSigners()

  const Unlock = await ethers.getContractFactory('Unlock')
  const unlock = await upgrades.deployProxy(Unlock, [deployer.address], {
    initializer: 'initialize(address)',
  })
  await unlock.deployed()

  // eslint-disable-next-line no-console
  console.log(
    `UNLOCK SETUP > Unlock (w proxy) deployed to: ${unlock.address} (tx: ${unlock.deployTransaction.hash})`
  )

  // save deployment info
  await addDeployment('Unlock', unlock, true)

  return unlock.address
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

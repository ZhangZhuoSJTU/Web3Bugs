const { ethers } = require('hardhat')
const { SafeFactory, EthersAdapter } = require('@gnosis.pm/safe-core-sdk')

async function main({ owners, threshold }) {
  if (!owners) {
    // eslint-disable-next-line no-console
    throw new Error('GNOSIS SAFE SETUP > Missing owners.')
  }
  if (owners.length % 2 == 0) {
    // eslint-disable-next-line no-console
    throw new Error('GNOSIS SAFE SETUP > Number of owners should be odd.')
  }
  if (!threshold) {
    // eslint-disable-next-line no-console
    throw new Error('GNOSIS SAFE SETUP > Missing threshold.')
  }
  if (owners.length < threshold) {
    // eslint-disable-next-line no-console
    throw new Error(
      'GNOSIS SAFE SETUP > Threshold is greater than number of owners.'
    )
  }

  const [deployer] = await ethers.getSigners()

  const ethAdapter = new EthersAdapter({ ethers, signer: deployer })
  const safeFactory = await SafeFactory.create({ ethAdapter })

  const safe = await safeFactory.deploySafe({
    owners,
    threshold,
  })
  const safeAddress = safe.getAddress()

  // eslint-disable-next-line no-console
  console.log('GNOSIS SAFE SETUP > New safe deployed at: ', safeAddress)

  return safeAddress
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

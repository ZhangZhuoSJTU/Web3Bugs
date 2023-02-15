const hre = require('hardhat')

async function main() {
  await hre.storageLayout.export()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(1)
  })

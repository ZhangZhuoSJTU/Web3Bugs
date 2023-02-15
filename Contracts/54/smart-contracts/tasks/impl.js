const { task } = require('hardhat/config')
const {
  Manifest,
  hashBytecodeWithoutMetadata,
} = require('@openzeppelin/upgrades-core')

const { pathExists } = require('fs-extra')
const { getNetworkName } = require('../helpers/network')

task('impl', 'Get the contract implementation address')
  .addParam('contract', 'The contract path')
  .setAction(async ({ contract }, { ethers, network }) => {
    const { chainId } = await ethers.provider.getNetwork()
    const networkName = getNetworkName(chainId)

    if (!(await pathExists(contract))) {
      // eslint-disable-next-line no-console
      console.log(`ERROR: Contract file not found: ${contract}...`)
      return
    }

    // parse OZ manifest
    const manifestParser = await Manifest.forNetwork(network.provider)
    const manifest = await manifestParser.read()

    const contractName = contract.replace('contracts/', '').replace('.sol', '')
    const factory = await ethers.getContractFactory(contractName)

    // get implementation address
    const bytecodeHash = hashBytecodeWithoutMetadata(factory.bytecode)
    if (Object.keys(manifest.impls).includes(bytecodeHash)) {
      const { address } = manifest.impls[bytecodeHash]
      // eslint-disable-next-line no-console
      console.log(`> implementation address: ${address}`)
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `No implementation found in .openzeppelin ${networkName} manifest.`
      )
    }
  })

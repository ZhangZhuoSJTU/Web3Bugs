const { task } = require('hardhat/config')
const { getNetworkName } = require('../helpers/network')
const {
  getProxyAddress,
  getProxyAdminAddress,
} = require('../helpers/deployments')

const getDeploymentInfo = async ({ ethers, contract }) => {
  const contractName = contract.replace('contracts/', '').replace('.sol', '')

  // chainId
  let { chainId } = await ethers.provider.getNetwork()
  if (process.env.RUN_MAINNET_FORK) {
    chainId = 1
  }
  const networkName = getNetworkName(chainId)
  const proxyAddress = getProxyAddress(chainId, contractName)

  return {
    contractName,
    chainId,
    networkName,
    proxyAddress,
  }
}

task('upgrade', 'Upgrade an existing contract with a new implementation')
  .addParam('contract', 'The contract path')
  .setAction(async ({ contract }, { ethers, network }) => {
    const { contractName, networkName, proxyAddress } = await getDeploymentInfo(
      {
        ethers,
        contract,
      }
    )
    const proxyAdminAddress = await getProxyAdminAddress({ network })

    // eslint-disable-next-line no-console
    console.log(
      `Deploying new implementation of ${contractName} on ${networkName}...`
    )

    // eslint-disable-next-line global-require
    const prepareUpgrade = require('../scripts/upgrade/prepare')

    const implementation = await prepareUpgrade({
      proxyAddress,
      contractName,
    })

    // eslint-disable-next-line global-require
    const proposeUpgrade = require('../scripts/upgrade/propose')
    await proposeUpgrade({
      proxyAddress,
      proxyAdminAddress,
      implementation,
    })
  })

task('upgrade:prepare', 'Deploy the implementation of an upgreadable contract')
  .addParam('contract', 'The contract path')
  .setAction(async ({ contract }, { ethers }) => {
    // get contract deployment info
    const { contractName, networkName, proxyAddress } = await getDeploymentInfo(
      {
        ethers,
        contract,
      }
    )

    // eslint-disable-next-line no-console
    console.log(
      `Deploying new implementation of ${contractName} on ${networkName}...`
    )

    // eslint-disable-next-line global-require
    const prepareUpgrade = require('../scripts/upgrade/prepare')

    await prepareUpgrade({
      proxyAddress,
      contractName,
    })
  })

/**
 *
 * ex. UDT on mainnet
 * yarn hardhat propose-upgrade --proxy-address 0x90DE74265a416e1393A450752175AED98fe11517 \
 * --implementation xxx
 *
 */

task('upgrade:propose', 'Send an upgrade implementation proposal to multisig')
  .addParam('contract', 'The contract path')
  .addParam('implementation', 'The implementation contract path')
  .setAction(async ({ contract, implementation }, { ethers, network }) => {
    // get contract deployment info
    const { proxyAddress } = getDeploymentInfo({
      ethers,
      contract,
    })

    const proxyAdminAddress = await getProxyAdminAddress({ network })

    // eslint-disable-next-line global-require
    const proposeUpgrade = require('../scripts/upgrade/propose')
    await proposeUpgrade({
      proxyAddress,
      proxyAdminAddress,
      implementation,
    })
  })

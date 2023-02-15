const fs = require('fs-extra')
const path = require('path')

const { Manifest } = require('@openzeppelin/upgrades-core')
const { getNetworkName } = require('./network')
const OZ_SDK_EXPORT = require('../openzeppelin-cli-export.json')

const deploymentsPath = path.resolve(__dirname, '../deployments')

const getDeploymentsFolder = (chainId) => {
  // parse network name
  const networkName = getNetworkName(chainId)
  const deployFolderPath = path.join(deploymentsPath, networkName)

  // create folder it if it doesnt exist
  fs.ensureDirSync(deployFolderPath)

  return deployFolderPath
}

const getDeploymentsFilePath = (chainId, contractName) => {
  const deploymentFolder = getDeploymentsFolder(chainId)
  const deploymentPath = path.join(deploymentFolder, `${contractName}.json`)
  return deploymentPath
}

async function getImplementationAddress(proxyAddress) {
  // eslint-disable-next-line global-require
  const { ethers } = require('hardhat')

  const implHex = await ethers.provider.getStorageAt(
    proxyAddress,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  )
  return ethers.utils.hexStripZeros(implHex)
}

const parseDeploymentInfo = async (contractName, instance, isProxy) => {
  // eslint-disable-next-line global-require
  const { artifacts } = require('hardhat')
  const artifact = await artifacts.readArtifact(contractName)
  const receipt = await instance.deployTransaction.wait()

  const deployment = {
    ...artifact,
    receipt,
    address: instance.address,
    txAddress: instance.deployTransaction.hash,
    chainId: instance.deployTransaction.chainId,
    from: instance.deployTransaction.from,
    blockNumber: instance.deployTransaction.blockNumber,
  }

  if (isProxy) {
    const implementationAddress = await getImplementationAddress(
      instance.address
    )
    deployment.isProxy = true
    deployment.implementationAddress = implementationAddress
  }

  return deployment
}

const addDeployment = async (contractName, instance, isProxy) => {
  // parse data
  const deployment = await parseDeploymentInfo(contractName, instance, isProxy)

  // parse path
  const deploymentFilePath = getDeploymentsFilePath(
    deployment.chainId,
    contractName
  )

  // save as JSON
  fs.outputJsonSync(deploymentFilePath, deployment, { spaces: 2 })

  return { ...deployment, path: deploymentFilePath }
}

const getDeployment = (chainId, contractName) => {
  // get ABI etc
  const deploymentFilePath = getDeploymentsFilePath(chainId, contractName)
  const { abi, address, implementationAddress } =
    fs.readJsonSync(deploymentFilePath)

  const networkName = process.env.RUN_MAINNET_FORK
    ? 'mainnet'
    : getNetworkName(chainId)

  const deployment = {
    contractName,
    abi,
    address,
    implementation: implementationAddress,
  }

  // support all networks
  if (networkName !== 'localhost') {
    const proxy = getProxyData({ networkName, contractName })
    deployment.address = proxy.address
    deployment.implementation = proxy.implementation
  }

  return deployment
}

const getProxyData = ({ networkName, contractName }) => {
  const { proxies } = OZ_SDK_EXPORT.networks[networkName]
  let proxy
  if (contractName === 'UnlockProtocolGovernor' && networkName === 'mainnet') {
    proxy = { address: '0x7757f7f21F5Fa9b1fd168642B79416051cd0BB94' }
  } else if (
    contractName === 'UnlockProtocolTimelock' &&
    networkName === 'mainnet'
  ) {
    proxy = { address: '0x17eedfb0a6e6e06e95b3a1f928dc4024240bc76b' }
  } else {
    try {
      const contractNameClean = contractName.replace('V2', '') // UDT v2 uses UDT v1 proxy
      ;[proxy] = proxies[`unlock-protocol/${contractNameClean}`]
    } catch (error) {
      throw new Error(
        `Missing network manifest for ${contractName} on ${networkName})`
      )
    }
  }
  return proxy
}

const getProxyAddress = function getProxyAddress(chainId, contractName) {
  const { address } = getDeployment(chainId, `${contractName}`)
  if (!address) {
    throw new Error(
      `The proxy address for ${contractName} was not found in the network manifest (chainId: ${chainId})`
    )
  }
  return address
}

const getProxyAdminAddress = async ({ network }) => {
  // get proxy admin address from OZ manifest
  const manifest = await Manifest.forNetwork(network.provider)
  const manifestAdmin = await manifest.getAdmin()
  const proxyAdminAddress = manifestAdmin.address
  if (proxyAdminAddress === undefined) {
    throw new Error('No ProxyAdmin was found in the network manifest')
  }
  return proxyAdminAddress
}

module.exports = {
  getProxyAdminAddress,
  getProxyAddress,
  addDeployment,
  getDeployment,
}

import { utils } from 'ethers'
import { ethers, network } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { addOrReplaceFacets } from '../utils/diamond'
import config from '../config/cbridge2'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  let bridgeAddr = '0xc578cbaf5a411dfa9f0d227f97dadaa4074ad062'
  let chainId = 1

  const { deployer } = await getNamedAccounts()

  await deploy('CBridgeFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  const cBridgeFacet = await ethers.getContract('CBridgeFacet')
  const diamond = await ethers.getContract('LiFiDiamond')

  const ABI = ['function initCbridge(address, uint64)']
  const iface = new utils.Interface(ABI)

  if (config[network.name].cBridge != '') {
    bridgeAddr = config[network.name].cBridge
    chainId = config[network.name].chainId
  }

  const initData = iface.encodeFunctionData('initCbridge', [
    bridgeAddr,
    chainId,
  ])

  await addOrReplaceFacets(
    [cBridgeFacet],
    diamond.address,
    cBridgeFacet.address,
    initData
  )
}
export default func
func.id = 'deploy_c_bridge_facet'
func.tags = ['DeployCBridgeFacet']
func.dependencies = [
  'InitialFacets',
  'LiFiDiamond',
  'InitFacets',
  'DeployDexManagerFacet',
]

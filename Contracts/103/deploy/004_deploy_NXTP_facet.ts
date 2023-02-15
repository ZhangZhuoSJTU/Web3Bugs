import { utils } from 'ethers'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import config from '../config/nxtp'
import { addOrReplaceFacets } from '../utils/diamond'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const TX_MGR_ADDR = config[network.name].txManagerAddress

  await deploy('NXTPFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  const nxtpFacet = await ethers.getContract('NXTPFacet')

  const diamond = await ethers.getContract('LiFiDiamond')

  const ABI = ['function initNXTP(address)']
  const iface = new utils.Interface(ABI)

  const initData = iface.encodeFunctionData('initNXTP', [TX_MGR_ADDR])

  await addOrReplaceFacets(
    [nxtpFacet],
    diamond.address,
    nxtpFacet.address,
    initData
  )
}
export default func
func.id = 'deploy_NXTP_facet'
func.tags = ['DeployNXTPFacet']
func.dependencies = [
  'InitialFacets',
  'LiFiDiamond',
  'InitFacets',
  'DeployDexManagerFacet',
]

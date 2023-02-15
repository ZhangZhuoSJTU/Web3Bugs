import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { addOrReplaceFacets } from '../utils/diamond'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre
  const { deploy } = deployments
  const alice = await ethers.getSigners()
  const deployer = alice[0].address

  await deploy('AnyswapFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  const anyswapFacet = await ethers.getContract('AnyswapFacet')

  const diamond = await ethers.getContract('LiFiDiamond')

  await addOrReplaceFacets([anyswapFacet], diamond.address)
}

export default func
func.id = 'deploy_anyswap_facet'
func.tags = ['DeployAnyswapFacet']
func.dependencies = [
  'InitialFacets',
  'LiFiDiamond',
  'InitFacets',
  'DeployDexManagerFacet',
]

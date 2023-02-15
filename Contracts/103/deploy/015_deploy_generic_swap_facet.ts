import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { addOrReplaceFacets } from '../utils/diamond'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy('GenericSwapFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  const genericSwapFacet = await ethers.getContract('GenericSwapFacet')

  const diamond = await ethers.getContract('LiFiDiamond')

  await addOrReplaceFacets([genericSwapFacet], diamond.address)
}
export default func
func.id = 'deploy_generic_swap_facet'
func.tags = ['DeployGenericSwapFacet']
func.dependencies = [
  'InitialFacets',
  'LiFiDiamond',
  'InitFacets',
  'DeployDexManagerFacet',
]

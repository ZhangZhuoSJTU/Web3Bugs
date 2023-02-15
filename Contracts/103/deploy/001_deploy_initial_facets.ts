import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy('DiamondCutFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  await deploy('DiamondLoupeFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  await deploy('OwnershipFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })
}
export default func
func.id = 'deploy_initial_facets'
func.tags = ['InitialFacets']

import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const diamondCutFacet = await ethers.getContract('DiamondCutFacet')

  await deploy('LiFiDiamond', {
    from: deployer,
    args: [deployer, diamondCutFacet.address],
    log: true,
    deterministicDeployment: true,
  })
}
export default func
func.id = 'deploy_lifi_diamond'
func.tags = ['LiFiDiamond']

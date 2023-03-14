import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('SHA1NSEC3Digest', {
    from: deployer,
    args: [],
    log: true,
  })
}

func.tags = ['dnssec-nsec3-digests']
func.dependencies = ['registry']

export default func

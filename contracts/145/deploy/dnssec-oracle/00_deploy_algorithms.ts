import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('RSASHA1Algorithm', {
    from: deployer,
    args: [],
    log: true,
  })
  await deploy('RSASHA256Algorithm', {
    from: deployer,
    args: [],
    log: true,
  })
  await deploy('P256SHA256Algorithm', {
    from: deployer,
    args: [],
    log: true,
  })

  if (network.tags.test) {
    await deploy('DummyAlgorithm', {
      from: deployer,
      args: [],
      log: true,
    })
  }
}

func.tags = ['dnssec-algorithms']

export default func

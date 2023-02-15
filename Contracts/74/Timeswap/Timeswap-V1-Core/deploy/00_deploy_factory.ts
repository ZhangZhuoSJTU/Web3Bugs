import { HardhatRuntimeEnvironment } from 'hardhat/types'
import type { DeployFunction } from 'hardhat-deploy/types'
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { factoryDeployer, factoryOwner } = await getNamedAccounts()
  const protocolFee = 30
  const fee = 30

  await deploy('TimeswapFactory', {
    from: factoryDeployer,
    args: [factoryOwner, fee, protocolFee],
    log: true,
  })
}
export default func

import { HardhatRuntimeEnvironment } from 'hardhat/types'
import type { DeployFunction } from 'hardhat-deploy/types'
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { factoryDeployer, factoryOwner } = await getNamedAccounts()
  const protocolFee = 30
  const fee = 30

  const TimeswapMath = await deploy('TimeswapMath', {
    from: factoryDeployer,
    log: true,
  })

  
  await deploy('TimeswapFactory', {
    from: factoryDeployer,
    args: [factoryOwner, fee, protocolFee],
    log: true,
    libraries: {
      TimeswapMath: TimeswapMath.address
    }
  })
}
export default func

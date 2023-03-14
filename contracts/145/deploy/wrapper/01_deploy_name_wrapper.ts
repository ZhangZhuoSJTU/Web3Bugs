import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry')
  const registrar = await ethers.getContract('BaseRegistrarImplementation')
  const metadata = await ethers.getContract('StaticMetadataService')

  const nameWrapper = await deploy('NameWrapper', {
    from: deployer,
    args: [registry.address, registrar.address, metadata.address],
    log: true,
  })

  const tx = await registrar.addController(nameWrapper.address, {
    from: deployer,
  })
  console.log(
    `Adding NameWrapper as controller on registrar (tx: ${tx.hash})...`,
  )
  await tx.wait()
}

func.id = 'name-wrapper'
func.tags = ['wrapper', 'NameWrapper']
func.dependencies = ['BaseRegistrarImplementation', 'registry']

export default func

import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy, run } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registrar = await ethers.getContract('BaseRegistrarImplementation')
  const priceOracle = await ethers.getContract('StablePriceOracle')
  const reverseRegistrar = await ethers.getContract('ReverseRegistrar')

  await deploy('LegacyETHRegistrarController', {
    from: deployer,
    args: [registrar.address, priceOracle.address, 60, 86400],
    log: true,
    contract: await deployments.getArtifact(
      'ETHRegistrarController_mainnet_9380471',
    ),
  })

  const controller = await ethers.getContract(
    'LegacyETHRegistrarController',
    await ethers.getSigner(owner),
  )

  const tx1 = await registrar.addController(controller.address, {
    from: deployer,
  })
  console.log(
    `Adding controller as controller on registrar (tx: ${tx1.hash})...`,
  )
  await tx1.wait()

  const tx3 = await reverseRegistrar.setController(controller.address, {
    from: deployer,
  })
  console.log(
    `Setting controller of ReverseRegistrar to controller (tx: ${tx3.hash})...`,
  )
  await tx3.wait()

  console.log('Running unwrapped name registrations...')
  await run('register-unwrapped-names', {
    deletePreviousDeployments: false,
    resetMemory: false,
  })
}

func.id = 'legacy-controller'
func.tags = ['ethregistrar', 'LegacyETHRegistrarController']
func.dependencies = ['registry', 'wrapper', 'LegacyPublicResolver']

export default func

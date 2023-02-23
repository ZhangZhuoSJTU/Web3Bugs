// eslint-disable no-console
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { DepositRecord } from '../typechain'

const { assertIsTestnetChain } = utils

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  console.log('Running DepositHook deployment script with', deployer, 'as the deployer')
  const currentChain = await getChainId()
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain as unknown as ChainId)
  // Retrieve existing non-upgradeable deployments using hardhat-deploy
  const depositRecord = (await ethers.getContract('DepositRecord')) as DepositRecord
  // Deploy DepositHook and configure external contracts to point to it
  const { address: depositHookAddress, newlyDeployed: depositHookNewlyDeployed } = await deploy(
    'DepositHook',
    {
      from: deployer,
      contract: 'DepositHook',
      deterministicDeployment: false,
      args: [depositRecord.address],
      skipIfAlreadyDeployed: true,
    }
  )
  if (depositHookNewlyDeployed) {
    console.log('Deployed DepositHook to', depositHookAddress)
  } else {
    console.log('Existing DepositHook at', depositHookAddress)
  }
  if (!(await depositRecord.isHookAllowed(depositHookAddress))) {
    console.log(
      'Configuring DepositRecord at',
      depositRecord.address,
      'to allow the DepositHook...'
    )
    const setAllowedHookTx = await depositRecord.setAllowedHook(depositHookAddress, true)
    await setAllowedHookTx.wait()
  }
  console.log('')
}

export default deployFunction

deployFunction.dependencies = ['DepositRecord']

deployFunction.tags = ['DepositHook']

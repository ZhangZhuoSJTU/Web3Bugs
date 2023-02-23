// eslint-disable no-console
import { parseEther } from 'ethers/lib/utils'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId } from 'prepo-constants'
import { utils } from 'prepo-hardhat'

const { assertIsTestnetChain } = utils

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  console.log('Running DepositRecord deployment script with', deployer, 'as the deployer')
  const currentChain = await getChainId()
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain as unknown as ChainId)
  const globalDepositCap = parseEther('100000')
  const accountDepositCap = parseEther('1000')
  const { address: depositRecordAddress, newlyDeployed } = await deploy('DepositRecord', {
    from: deployer,
    contract: 'DepositRecord',
    deterministicDeployment: false,
    args: [globalDepositCap, accountDepositCap],
    skipIfAlreadyDeployed: true,
  })
  if (newlyDeployed) {
    console.log('Deployed DepositRecord to', depositRecordAddress)
  } else {
    console.log('Existing DepositRecord at', depositRecordAddress)
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['DepositRecord']

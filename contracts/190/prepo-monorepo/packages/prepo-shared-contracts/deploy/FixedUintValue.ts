/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { FixedUintValue } from '../types/generated'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, sendTxAndWait } = utils

const deployFunction: DeployFunction = async function deployFixedUintValue({
  ethers,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { deploy } = deployments
  const deployer = (await ethers.getSigners())[0]
  console.log(
    'Running FixedUintValue deployment script with',
    deployer.address,
    'as the deployer'
  )
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain)

  const { address: fixedUintValueAddress, newlyDeployed: fixedUintValueNewlyDeployed } =
    await deploy('FixedUintValue', {
      from: deployer.address,
      contract: 'FixedUintValue',
      deterministicDeployment: false,
      args: [],
      skipIfAlreadyDeployed: true,
    })
  if (fixedUintValueNewlyDeployed) {
    console.log('Deployed FixedUintValue to', fixedUintValueAddress)
  } else {
    console.log('Existing FixedUintValue at', fixedUintValueAddress)
  }
  const governanceAddress = getPrePOAddressForNetwork(
    'GOVERNANCE',
    currentNetwork.name,
    process.env.GOVERNANCE
  )
  console.log('Governance for the current network is at:', governanceAddress)
  const fixedUintValue = (await ethers.getContract('FixedUintValue')) as FixedUintValue
  if ((await fixedUintValue.owner()) !== governanceAddress) {
    console.log('Transferring ownership to', governanceAddress)
    await sendTxAndWait(
      await fixedUintValue.connect(deployer).transferOwnership(governanceAddress)
    )
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['FixedUintValue']

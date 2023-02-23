/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { MiniSales } from '../types/generated'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, sendTxAndWait } = utils

const deployFunction: DeployFunction = async function deployMiniSales({
  ethers,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { deploy, getOrNull } = deployments
  const deployer = (await ethers.getSigners())[0]
  console.log('Running MiniSales deployment script with', deployer.address, 'as the deployer')
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain)
  const governanceAddress = getPrePOAddressForNetwork(
    'GOVERNANCE',
    currentNetwork.name,
    process.env.GOVERNANCE
  )
  const usdcAddress = getPrePOAddressForNetwork('USDC', currentNetwork.name, process.env.USDC)
  console.log('Governance for the current network is at:', governanceAddress)
  // Check if there is an existing PPO deployment
  const existingPPO = await getOrNull(DEPLOYMENT_NAMES.ppo.name)
  if (!existingPPO)
    throw new Error(`No existing PPO deployment exists for the ${currentNetwork.name} network`)

  const nameOfMiniSales = ''
  if (!nameOfMiniSales) throw new Error('Name must be specified before deploying MiniSales')

  const { address: miniSalesAddress, newlyDeployed: miniSalesNewlyDeployed } = await deploy(
    nameOfMiniSales,
    {
      from: deployer.address,
      contract: 'MiniSales',
      deterministicDeployment: false,
      args: [existingPPO.address, usdcAddress, 18],
      skipIfAlreadyDeployed: true,
    }
  )
  if (miniSalesNewlyDeployed) {
    console.log('Deployed MiniSales to', miniSalesAddress)
  } else {
    console.log('Existing MiniSales at', miniSalesAddress)
  }
  const miniSales = (await ethers.getContract(nameOfMiniSales)) as MiniSales
  if ((await miniSales.owner()) !== governanceAddress) {
    console.log('Transferring ownership to', governanceAddress)
    await sendTxAndWait(await miniSales.connect(deployer).transferOwnership(governanceAddress))
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['MiniSales']

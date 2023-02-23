/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import dotenv from 'dotenv'
import { MiniSalesFlag } from '../types/generated'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain } = utils

const deployFunction: DeployFunction = async function deployMiniSalesFlag({
  ethers,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { deploy } = deployments
  const deployer = (await ethers.getSigners())[0]
  console.log('Running MiniSalesFlag deployment script with', deployer.address, 'as the deployer')
  const currentChain = Number(await getChainId()) as ChainId
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain)

  const nameOfMiniSalesFlag = ''
  if (!nameOfMiniSalesFlag) throw new Error('Name must be specified before deploying MiniSalesFlag')

  const { address: miniSalesFlagAddress, newlyDeployed: miniSalesFlagNewlyDeployed } = await deploy(
    nameOfMiniSalesFlag,
    {
      from: deployer.address,
      contract: 'MiniSalesFlag',
      deterministicDeployment: false,
      args: [],
      skipIfAlreadyDeployed: true,
    }
  )
  if (miniSalesFlagNewlyDeployed) {
    console.log('Deployed MiniSalesFlag to', miniSalesFlagAddress)
  } else {
    console.log('Existing MiniSalesFlag at', miniSalesFlagAddress)
  }
  const miniSalesFlag = (await ethers.getContract(nameOfMiniSalesFlag)) as MiniSalesFlag
  const owner = await miniSalesFlag.owner()
  console.log(`Deployed MiniSalesFlag with ${owner} as owner`)
  console.log('')
}

export default deployFunction

deployFunction.tags = ['MiniSalesFlag']

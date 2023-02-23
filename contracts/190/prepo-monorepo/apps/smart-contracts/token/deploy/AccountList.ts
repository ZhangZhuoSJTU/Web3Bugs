/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { AccountList } from '../types/generated'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, sendTxAndWait } = utils

const deployFunction: DeployFunction = async function deployAccountList({
  ethers,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { deploy } = deployments
  const deployer = (await ethers.getSigners())[0]
  console.log('Running AccountList deployment script with', deployer.address, 'as the deployer')
  const currentChain = Number(await getChainId()) as ChainId
  const currentNetwork = getNetworkByChainId(currentChain)
  /**
   * Make sure this script is not accidentally targeted towards a production environment.
   * This can be temporarily removed if deploying to prod.
   */
  assertIsTestnetChain(currentChain)

  const nameOfAccountList = ''
  if (!nameOfAccountList) throw new Error('Name must be specified before deploying AccountList')

  const { address: accountListAddress, newlyDeployed: accountListNewlyDeployed } = await deploy(
    nameOfAccountList,
    {
      from: deployer.address,
      contract: 'AccountList',
      deterministicDeployment: false,
      args: [],
      skipIfAlreadyDeployed: true,
    }
  )
  if (accountListNewlyDeployed) {
    console.log('Deployed', nameOfAccountList, 'to', accountListAddress)
  } else {
    console.log('Existing', nameOfAccountList, 'at', accountListAddress)
  }
  const governanceAddress = getPrePOAddressForNetwork(
    'GOVERNANCE',
    currentNetwork.name,
    process.env.GOVERNANCE
  )
  console.log('Governance for the current network is at:', governanceAddress)
  const accountList = (await ethers.getContract(nameOfAccountList)) as AccountList
  if ((await accountList.owner()) !== governanceAddress) {
    console.log('Transferring ownership to', governanceAddress)
    await sendTxAndWait(await accountList.connect(deployer).transferOwnership(governanceAddress))
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['AccountList']

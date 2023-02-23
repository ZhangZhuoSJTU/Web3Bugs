/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { BlocklistTransferHook } from '../types/generated'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, sendTxAndWait } = utils

const deployFunction: DeployFunction = async function deployBlocklistTransferHook({
  ethers,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { deploy, getOrNull } = deployments
  const deployer = (await ethers.getSigners())[0]
  console.log(
    'Running BlocklistTransferHook deployment script with',
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
  // Check if there is an existing AccountList to serve as the blocklist
  const existingBlocklist = await getOrNull('BlocklistTransferHook-AccountList')
  if (!existingBlocklist) {
    throw new Error(
      `No existing BlocklistTransferHook-AccountList deployment exists for the ${currentNetwork.name} network`
    )
  }
  const governanceAddress = getPrePOAddressForNetwork(
    'GOVERNANCE',
    currentNetwork.name,
    process.env.GOVERNANCE
  )
  console.log('Governance for the current network is at:', governanceAddress)
  const {
    address: blocklistTransferHookAddress,
    newlyDeployed: blocklistTransferHookNewlyDeployed,
  } = await deploy('BlocklistTransferHook', {
    from: deployer.address,
    contract: 'BlocklistTransferHook',
    deterministicDeployment: false,
    args: [],
    skipIfAlreadyDeployed: true,
  })
  if (blocklistTransferHookNewlyDeployed) {
    console.log('Deployed BlocklistTransferHook to', blocklistTransferHookAddress)
  } else {
    console.log('Existing BlocklistTransferHook at', blocklistTransferHookAddress)
  }
  const blocklistTransferHook = (await ethers.getContract(
    'BlocklistTransferHook'
  )) as BlocklistTransferHook
  if ((await blocklistTransferHook.getBlocklist()) !== existingBlocklist.address) {
    console.log('Setting BlocklistTransferHook to use Blocklist at', existingBlocklist.address)
    await sendTxAndWait(
      await blocklistTransferHook.connect(deployer).setBlocklist(existingBlocklist.address)
    )
  }
  if ((await blocklistTransferHook.owner()) !== governanceAddress) {
    console.log('Transferring ownership to', governanceAddress)
    await sendTxAndWait(
      await blocklistTransferHook.connect(deployer).transferOwnership(governanceAddress)
    )
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['BlocklistTransferHook']

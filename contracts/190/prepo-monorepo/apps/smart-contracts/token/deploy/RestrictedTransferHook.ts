/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import dotenv from 'dotenv'
import { RestrictedTransferHook } from '../types/generated'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, sendTxAndWait } = utils

const deployFunction: DeployFunction = async function deployRestrictedTransferHook({
  ethers,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { deploy, getOrNull } = deployments
  const deployer = (await ethers.getSigners())[0]
  console.log(
    'Running RestrictedTransferHook deployment script with',
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
  const existingBlocklist = await getOrNull(
    DEPLOYMENT_NAMES.ppo.restrictedTransferHook.blocklist.name
  )
  if (!existingBlocklist)
    throw new Error(
      `No existing ${DEPLOYMENT_NAMES.ppo.restrictedTransferHook.blocklist.name} deployment exists for the ${currentNetwork.name} network`
    )
  // Check if there is an existing AccountList to serve as the source allowlist
  const existingSourceAllowlist = await getOrNull(
    DEPLOYMENT_NAMES.ppo.restrictedTransferHook.sourceAllowlist.name
  )
  if (!existingSourceAllowlist)
    throw new Error(
      `No existing ${DEPLOYMENT_NAMES.ppo.restrictedTransferHook.sourceAllowlist.name} deployment exists for the ${currentNetwork.name} network`
    )
  // Check if there is an existing AccountList to serve as the destination allowlist
  const existingDestinationAllowlist = await getOrNull(
    DEPLOYMENT_NAMES.ppo.restrictedTransferHook.destinationAllowlist.name
  )
  if (!existingDestinationAllowlist)
    throw new Error(
      `No existing ${DEPLOYMENT_NAMES.ppo.restrictedTransferHook.destinationAllowlist.name} deployment exists for the ${currentNetwork.name} network`
    )
  const governanceAddress = getPrePOAddressForNetwork(
    'GOVERNANCE',
    currentNetwork.name,
    process.env.GOVERNANCE
  )
  console.log('Governance for the current network is at:', governanceAddress)
  const {
    address: restrictedTransferHookAddress,
    newlyDeployed: restrictedTransferHookNewlyDeployed,
  } = await deploy(DEPLOYMENT_NAMES.ppo.restrictedTransferHook.name, {
    from: deployer.address,
    contract: 'RestrictedTransferHook',
    deterministicDeployment: false,
    args: [],
    skipIfAlreadyDeployed: true,
  })
  if (restrictedTransferHookNewlyDeployed) {
    console.log('Deployed RestrictedTransferHook to', restrictedTransferHookAddress)
  } else {
    console.log('Existing RestrictedTransferHook at', restrictedTransferHookAddress)
  }
  const restrictedTransferHook = (await ethers.getContract(
    DEPLOYMENT_NAMES.ppo.restrictedTransferHook.name
  )) as RestrictedTransferHook
  if ((await restrictedTransferHook.getBlocklist()) !== existingBlocklist.address) {
    console.log('Setting RestrictedTransferHook to use Blocklist at', existingBlocklist.address)
    await sendTxAndWait(
      await restrictedTransferHook.connect(deployer).setBlocklist(existingBlocklist.address)
    )
  }
  if ((await restrictedTransferHook.getSourceAllowlist()) !== existingSourceAllowlist.address) {
    console.log(
      'Setting RestrictedTransferHook to use SourceAllowlist at',
      existingSourceAllowlist.address
    )
    await sendTxAndWait(
      await restrictedTransferHook
        .connect(deployer)
        .setSourceAllowlist(existingSourceAllowlist.address)
    )
  }
  if (
    (await restrictedTransferHook.getDestinationAllowlist()) !==
    existingDestinationAllowlist.address
  ) {
    console.log(
      'Setting RestrictedTransferHook to use DestinationAllowlist at',
      existingDestinationAllowlist.address
    )
    await sendTxAndWait(
      await restrictedTransferHook
        .connect(deployer)
        .setDestinationAllowlist(existingDestinationAllowlist.address)
    )
  }
  if ((await restrictedTransferHook.owner()) !== governanceAddress) {
    console.log('Transferring ownership to', governanceAddress)
    await sendTxAndWait(
      await restrictedTransferHook.connect(deployer).transferOwnership(governanceAddress)
    )
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['RestrictedTransferHook']

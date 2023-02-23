/* eslint-disable no-console */
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ChainId, DEPLOYMENT_NAMES, getPrePOAddressForNetwork } from 'prepo-constants'
import { sendTxAndWait, utils } from 'prepo-hardhat'
import { getNetworkByChainId } from 'prepo-utils'
import { HardhatUpgrades } from '@openzeppelin/hardhat-upgrades'
import dotenv from 'dotenv'
import { FormatTypes, getContractAddress } from 'ethers/lib/utils'
import { fromChainId } from 'defender-base-client'
import { TransactionResponse } from '@ethersproject/providers'

dotenv.config({
  path: '../.env',
})

const { assertIsTestnetChain, getDefenderAdminClient } = utils

async function ensureProxyOwnedByGovernance(
  upgrades: HardhatUpgrades,
  governanceAddress: string
): Promise<void> {
  const manifestAdmin = await upgrades.admin.getInstance()
  console.log('ProxyAdmin exists at:', manifestAdmin.address)
  const adminOwner = await manifestAdmin.owner()
  console.log('Current ProxyAdmin owned by:', adminOwner)
  if (adminOwner !== governanceAddress) {
    console.log('ProxyAdmin not owned by governance, transferring ownership to', governanceAddress)
    await upgrades.admin.transferProxyAdminOwnership(governanceAddress)
  }
}

const deployFunction: DeployFunction = async function deployPPO({
  deployments,
  getChainId,
  ethers,
  upgrades,
}: HardhatRuntimeEnvironment): Promise<void> {
  const { save, getOrNull, getArtifact } = deployments
  const deployer = (await ethers.getSigners())[0]
  console.log('Running PPO deployment script with', deployer.address, 'as the deployer')
  /**
   * getChainId returns a string, and because an enum can exist as both a
   * string and number, this will cause a problem with getNetworkByChainId
   * which performs a `===` exact equivalence check against ChainIds using
   * the `number` type. Thus, you must explicitly convert the ChainId into a
   * number for `getNetworkByChainId` to work.
   */
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
  console.log('Governance for the current network is at:', governanceAddress)
  const ppoTokenFactory = await ethers.getContractFactory('PPO')
  const existingDeployment = await getOrNull(DEPLOYMENT_NAMES.ppo.name)
  if (!existingDeployment) {
    console.log('Existing deployment not detected, deploying new contract')
    const newDeployment = await upgrades.deployProxy(ppoTokenFactory, ['prePO Token', 'PPO'])
    console.log('Deployed PPO at', newDeployment.address)
    const deploymentReceipt = await newDeployment.deployTransaction.wait()
    /**
     * Although `deployProxy` returns an ABI, we have to refetch the ABI from
     * hardhat-deploy since ABIs returned from OZ have some compatibility
     * issues with `hardhat-deploy`. If you try to fetch a manually saved
     * contract saved with an ABI returned from `deployProxy`, it will fail.
     */
    const ppoArtifact = await getArtifact('PPO')
    await save(DEPLOYMENT_NAMES.ppo.name, {
      abi: ppoArtifact.abi,
      address: newDeployment.address,
      receipt: deploymentReceipt,
    })
    await ensureProxyOwnedByGovernance(upgrades, governanceAddress)
  } else {
    console.log('Existing deployment detected, upgrading contract')
    await ensureProxyOwnedByGovernance(upgrades, governanceAddress)
    /**
     * Need to explicitly cast as TransactionResponse since an upgrade
     * proposal can be a string or TransactionResponse object. Tedious string
     * checks for when it is not a TransactionResponse would be required
     * multiple times throughout the script if we do not explicitly recast.
     */
    const upgradeResponse = (await upgrades.prepareUpgrade(
      existingDeployment.address,
      ppoTokenFactory,
      {
        getTxResponse: true,
      }
    )) as TransactionResponse
    const newImplAddress = getContractAddress(upgradeResponse)
    const upgradeReceipt = await upgradeResponse.wait()
    const defenderClient = getDefenderAdminClient(currentChain)
    const upgradeProposal = await defenderClient.proposeUpgrade(
      {
        title: 'PPO Upgrade',
        description: 'PPO Upgrade Proposal',
        proxyAdmin: (await upgrades.admin.getInstance()).address,
        newImplementation: newImplAddress,
      },
      {
        address: existingDeployment.address,
        network: fromChainId(currentChain),
        abi: ppoTokenFactory.interface.format(FormatTypes.json) as string,
      }
    )
    console.log('PPO Upgrade Proposal Receipt:', upgradeResponse)
    /**
     * Because this is only a proposal and not an actual deployment, a
     * contract instance is not returned for us to fetch a `hardhat-deploy`
     * readable ABI. Instead, we must fetch the artifact locally using
     * `getArtifact` from `hardhat-deploy` which contains a `hardhat-deploy`
     * compatible ABI.
     *
     * Since we don't actually know if the upgrade proposal will pass this,
     * script assumes the upgrade happened and overwrites the existing
     * deployment with the new ABI.
     */
    const ppoArtifact = await getArtifact('PPO')
    await save(DEPLOYMENT_NAMES.ppo.name, {
      abi: ppoArtifact.abi,
      address: upgradeProposal.contract.address,
      receipt: upgradeReceipt,
    })
  }
  const ppo = await ethers.getContract(DEPLOYMENT_NAMES.ppo.name)
  if ((await ppo.owner()) !== governanceAddress) {
    console.log('Transferring ownership to', governanceAddress)
    await sendTxAndWait(await ppo.connect(deployer).transferOwnership(governanceAddress))
  }
  console.log('')
}

export default deployFunction

deployFunction.tags = ['PPO']

import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { Contract, ContractTransaction } from 'ethers'
import { getAddress } from 'ethers/lib/utils'
import { PrePOMarketFactory } from '../typechain'

/**
 * Check if deployment for the specified network exists. Need to do this
 * for PrePOMarketFactory and Collateral contracts since they are
 * upgradeable and deployed via OpenZeppelin's hardhat-upgrades rather
 * than hardhat-deploy.
 */
async function fetchExistingDeploymentFromEnvironment(
  envVarName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contractFactory: any
): Promise<Contract> {
  const valueFromEnvVar = process.env[envVarName]
  if (!valueFromEnvVar) {
    throw new Error(`environment variable ${envVarName} does not exist`)
  }
  const existingAddress = getAddress(valueFromEnvVar as string)
  return (await contractFactory.attach(existingAddress)) as Contract
}
// TODO: replace collateral with preUSD
// export async function fetchExistingCollateral(
//   chainId: string,
//   ethers: HardhatEthersHelpers
// ): Promise<Collateral> {
//   return (await fetchExistingDeploymentFromEnvironment(
//     `COLLATERAL_${chainId}`,
//     await ethers.getContractFactory('Collateral')
//   )) as Collateral
// }

export async function fetchExistingPrePOMarketFactory(
  chainId: string,
  ethers: HardhatEthersHelpers
): Promise<PrePOMarketFactory> {
  return (await fetchExistingDeploymentFromEnvironment(
    `PREPO_MARKET_FACTORY_${chainId}`,
    await ethers.getContractFactory('PrePOMarketFactory')
  )) as PrePOMarketFactory
}

export async function sendTxAndWait(transaction: ContractTransaction): Promise<void> {
  await transaction.wait()
}

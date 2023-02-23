import { ContractFactory } from 'ethers'
import { ethers } from 'hardhat'

export function getFactory(contract: string): Promise<ContractFactory> {
  return ethers.getContractFactory(contract) as unknown as Promise<ContractFactory>
}

export function getFactories(contracts: string[]): Promise<ContractFactory>[] {
  return contracts.map((contract) => getFactory(contract))
}

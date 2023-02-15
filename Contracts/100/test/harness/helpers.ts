import { ethers } from 'hardhat'

export function getFactories(contracts: string[]) {
    return contracts.map((contract) => getFactory(contract))
}

export function getFactory(contract: string) {
    return ethers.getContractFactory(contract)
}

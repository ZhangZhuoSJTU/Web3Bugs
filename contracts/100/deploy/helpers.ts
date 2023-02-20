import { HardhatEthersHelpers } from '@nomiclabs/hardhat-ethers/types'
import { ContractTransaction } from 'ethers'
import { getAddress } from 'ethers/lib/utils'
import { Collateral } from '../typechain'

export async function fetchExistingCollateral(
    chainId: string,
    ethers: HardhatEthersHelpers
) {
    const collateralFactory = await ethers.getContractFactory('Collateral')
    /**
     * Check if Collateral contract for the specified network exists, need to do this because
     * Collateral contract is deployed using OZ's upgrade library, not hardhat-deploy.
     */
    const existingCollateralAddress = process.env['COLLATERAL_' + chainId]
    if (!existingCollateralAddress) {
        throw new Error(
            'Collateral contract for the network is not configured'
        )
    }
    const collateralAddress = getAddress(existingCollateralAddress as string)
    return (await collateralFactory.attach(collateralAddress)) as Collateral
}

export async function sendTxAndWait(transaction: ContractTransaction) {
    await transaction.wait()
}

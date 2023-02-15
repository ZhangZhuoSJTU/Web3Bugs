import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { CollateralDepositRecord } from '../../typechain'
import { MockContract, smock } from '@defi-wonderland/smock'

chai.use(solidity)

export async function collateralDepositRecordFixture(
    globalDepositCap: BigNumber,
    accountDepositCap: BigNumber
): Promise<CollateralDepositRecord> {
    const CollateralDepositRecord = await ethers.getContractFactory(
        'CollateralDepositRecord'
    )
    return (await CollateralDepositRecord.deploy(
        globalDepositCap,
        accountDepositCap
    )) as any
}

export async function smockCollateralDepositRecordFixture(
    globalDepositCap: BigNumber,
    accountDepositCap: BigNumber
): Promise<MockContract> {
    const smockCollateralDepositRecord = await smock.mock(
        'CollateralDepositRecord'
    )
    return (await smockCollateralDepositRecord.deploy(
        globalDepositCap,
        accountDepositCap
    )) as any
}

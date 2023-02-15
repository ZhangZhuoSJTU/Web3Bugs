import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { DepositHook, WithdrawHook } from '../../typechain'
import { MockContract, smock } from '@defi-wonderland/smock'

chai.use(solidity)

export async function depositHookFixture(
    accountAccessController: string,
    depositRecordAddress: string
): Promise<DepositHook> {
    const DepositHook = await ethers.getContractFactory('DepositHook')
    return (await DepositHook.deploy(
        accountAccessController,
        depositRecordAddress
    )) as any
}

export async function withdrawHookFixture(
    depositRecordAddress: string
): Promise<WithdrawHook> {
    const WithdrawHook = await ethers.getContractFactory('WithdrawHook')
    return (await WithdrawHook.deploy(depositRecordAddress)) as any
}

export async function smockDepositHookFixture(
    accountAccessController: string,
    depositRecordAddress: string
): Promise<MockContract> {
    const smockDepositHookFactory = await smock.mock('DepositHook')
    return await smockDepositHookFactory.deploy(
        accountAccessController,
        depositRecordAddress
    )
}

export async function smockWithdrawHookFixture(
    depositRecordAddress: string
): Promise<MockContract> {
    const smockWithdrawHookFactory = await smock.mock('WithdrawHook')
    return await smockWithdrawHookFactory.deploy(depositRecordAddress)
}

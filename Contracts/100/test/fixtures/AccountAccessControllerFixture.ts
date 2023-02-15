import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import {
    AccountAccessController,
    MockAccountAccessController,
} from '../../typechain'
import { MockContract, smock } from '@defi-wonderland/smock'

chai.use(solidity)

export async function accountAccessControllerFixture(): Promise<AccountAccessController> {
    const AccountAccessController = await ethers.getContractFactory(
        'AccountAccessController'
    )
    return (await AccountAccessController.deploy()) as any
}

export async function mockAccountAccessControllerFixture(): Promise<MockAccountAccessController> {
    const MockAccountAccessController = await ethers.getContractFactory(
        'MockAccountAccessController'
    )
    return (await MockAccountAccessController.deploy()) as any
}

export async function smockAccountAccessControllerFixture(): Promise<MockContract> {
    const smockAccountAccessControllerFactory = await smock.mock(
        'AccountAccessController'
    )
    return await smockAccountAccessControllerFactory.deploy()
}

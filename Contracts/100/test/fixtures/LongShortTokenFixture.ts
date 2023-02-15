import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { LongShortToken } from '../../typechain'

chai.use(solidity)

export async function LongShortTokenFixture(
    tokenName: string,
    tokenSymbol: string
): Promise<LongShortToken> {
    const longShort = await ethers.getContractFactory('LongShortToken')
    return (await longShort.deploy(tokenName, tokenSymbol)) as any
}

export async function LongShortTokenAttachFixture(
    tokenAddress: string
): Promise<LongShortToken> {
    const mintable = await ethers.getContractFactory('LongShortToken')
    return mintable.attach(tokenAddress) as any
}

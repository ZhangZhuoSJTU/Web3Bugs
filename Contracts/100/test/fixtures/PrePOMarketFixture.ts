import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { PrePOMarket } from '../../typechain/PrePOMarket'

chai.use(solidity)

export async function prePOMarketFixture(
    governance: string,
    collateral: string,
    longToken: string,
    shortToken: string,
    floorLongPrice: BigNumber,
    ceilingLongPrice: BigNumber,
    floorValuation: BigNumber,
    ceilingValuation: BigNumber,
    mintingFee: number,
    redemptionFee: number,
    expiryTime: number,
    publicMinting: boolean
): Promise<PrePOMarket> {
    const prePOMarket = await ethers.getContractFactory('PrePOMarket')
    return (await prePOMarket.deploy(
        governance,
        collateral,
        longToken,
        shortToken,
        floorLongPrice,
        ceilingLongPrice,
        floorValuation,
        ceilingValuation,
        mintingFee,
        redemptionFee,
        expiryTime,
        publicMinting
    )) as any
}

export async function prePOMarketAttachFixture(
    marketAddress: string
): Promise<PrePOMarket> {
    const prePOMarket = await ethers.getContractFactory('PrePOMarket')
    return prePOMarket.attach(marketAddress) as any
}

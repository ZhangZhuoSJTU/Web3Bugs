import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, upgrades } from 'hardhat'
import { BigNumber } from 'ethers'
import { PrePOMarketFactory } from '../../typechain/PrePOMarketFactory'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { getMarketAddedEvent } from '../events'

chai.use(solidity)

export type CreateMarketParams = {
    caller: SignerWithAddress
    factory: PrePOMarketFactory
    tokenNameSuffix: string
    tokenSymbolSuffix: string
    governance: string
    collateral: string
    floorLongPrice: BigNumber
    ceilingLongPrice: BigNumber
    floorValuation: BigNumber
    ceilingValuation: BigNumber
    mintingFee: number
    redemptionFee: number
    expiryTime: number
}

export async function prePOMarketFactoryFixture(): Promise<PrePOMarketFactory> {
    const PrePOMarketFactory = await ethers.getContractFactory(
        'PrePOMarketFactory'
    )
    return (await upgrades.deployProxy(PrePOMarketFactory, [])) as any
}

// passing in factory so that block time is not incremented by factory initialization prior to createMarket call, returns address of deployed market
export async function createMarketFixture(
    marketParams: CreateMarketParams
): Promise<string> {
    await marketParams.factory
        .connect(marketParams.caller)
        .createMarket(
            marketParams.tokenNameSuffix,
            marketParams.tokenSymbolSuffix,
            marketParams.governance,
            marketParams.collateral,
            marketParams.floorLongPrice,
            marketParams.ceilingLongPrice,
            marketParams.floorValuation,
            marketParams.ceilingValuation,
            marketParams.mintingFee,
            marketParams.redemptionFee,
            marketParams.expiryTime
        )
    const events = await getMarketAddedEvent(marketParams.factory)
    return events.market
}

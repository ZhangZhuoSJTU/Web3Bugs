import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { smockLongShortTokenFixture } from './LongShortTokenFixture'
import { CreateMarketResult } from './PrePOMarketFactoryFixture'
import { PrePOMarket } from '../../typechain/PrePOMarket'

export type PrePOMarketParams = {
  governance: string
  collateral: string
  floorLongPayout: BigNumber
  ceilingLongPayout: BigNumber
  floorValuation: BigNumber
  ceilingValuation: BigNumber
  expiryTime: number
}

export type SmockPrePOMarket = {
  market: MockContract
  longToken: MockContract
  shortToken: MockContract
}

export async function prePOMarketFixture(
  marketParams: PrePOMarketParams,
  longTokenAddress: string,
  shortTokenAddress: string
): Promise<PrePOMarket> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prePOMarket: any = await ethers.getContractFactory('PrePOMarket')
  return (await prePOMarket.deploy(
    marketParams.governance,
    marketParams.collateral,
    longTokenAddress,
    shortTokenAddress,
    marketParams.floorLongPayout,
    marketParams.ceilingLongPayout,
    marketParams.floorValuation,
    marketParams.ceilingValuation,
    marketParams.expiryTime
  )) as PrePOMarket
}

export async function smockPrePOMarketFixture(
  marketParams: PrePOMarketParams,
  longTokenAddress: string,
  shortTokenAddress: string
): Promise<MockContract> {
  const smockFactory = await smock.mock('PrePOMarket')
  return (await smockFactory.deploy(
    marketParams.governance,
    marketParams.collateral,
    longTokenAddress,
    shortTokenAddress,
    marketParams.floorLongPayout,
    marketParams.ceilingLongPayout,
    marketParams.floorValuation,
    marketParams.ceilingValuation,
    marketParams.expiryTime
  )) as MockContract
}

export async function createSmockPrePOMarket(
  deployer: SignerWithAddress,
  tokenNameSuffix: string,
  tokenSymbolSuffix: string,
  marketParams: PrePOMarketParams
): Promise<SmockPrePOMarket> {
  const longToken = await smockLongShortTokenFixture(
    `LONG ${tokenNameSuffix}`,
    `L_${tokenSymbolSuffix}`
  )
  const shortToken = await smockLongShortTokenFixture(
    `SHORT ${tokenNameSuffix}`,
    `S_${tokenSymbolSuffix}`
  )
  const market = await smockPrePOMarketFixture(marketParams, longToken.address, shortToken.address)
  await longToken.connect(deployer).transferOwnership(market.address)
  await shortToken.connect(deployer).transferOwnership(market.address)
  return {
    market,
    longToken,
    shortToken,
  }
}

export async function fakePrePOMarketFixture(): Promise<FakeContract> {
  const fakeContract = await smock.fake('PrePOMarket')
  return fakeContract
}

export async function prePOMarketAttachFixture(
  market: string | CreateMarketResult
): Promise<PrePOMarket> {
  const marketAddress: string = typeof market !== 'string' ? market.market : market

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prePOMarket: any = await ethers.getContractFactory('PrePOMarket')
  return prePOMarket.attach(marketAddress) as PrePOMarket
}

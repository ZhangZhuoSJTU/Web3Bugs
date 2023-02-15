import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { MockERC20 } from '../typechain/MockERC20'
import { PrePOMarketFactory } from '../typechain/PrePOMarketFactory'
import { mockERC20Fixture } from './fixtures/MockERC20Fixture'
import { LongShortTokenAttachFixture } from './fixtures/LongShortTokenFixture'
import { prePOMarketAttachFixture } from './fixtures/PrePOMarketFixture'
import {
    CreateMarketParams,
    prePOMarketFactoryFixture,
    createMarketFixture,
} from './fixtures/PrePOMarketFactoryFixture'
import { getCollateralValidityChangedEvent } from './events'
import {
    AddressZero,
    nowPlusMonths,
    MAX_PRICE,
    FEE_DENOMINATOR,
    FEE_LIMIT,
    revertReason,
} from './utils'
import { BigNumber } from 'ethers'

chai.use(solidity)

describe('=> PrePOMarketFactory', () => {
    let prePOMarketFactory: PrePOMarketFactory
    let collateralToken: MockERC20
    let deployer: SignerWithAddress
    let user: SignerWithAddress
    let user2: SignerWithAddress
    let treasury: SignerWithAddress
    const TEST_NAME_SUFFIX = 'preSTRIPE 100-200 30-September-2021'
    const TEST_SYMBOL_SUFFIX = 'preSTRIPE_100-200_30SEP21'
    const TEST_FLOOR_VAL = ethers.utils.parseEther('100')
    const TEST_CEILING_VAL = ethers.utils.parseEther('200')
    const TEST_MINTING_FEE = 10
    const TEST_REDEMPTION_FEE = 20
    const TEST_EXPIRY = nowPlusMonths(2)
    const TEST_FLOOR_PRICE = ethers.utils.parseEther('0.2')
    const TEST_CEILING_PRICE = ethers.utils.parseEther('0.8')
    const MOCK_COLLATERAL_SUPPLY = ethers.utils.parseEther('1000000000')

    beforeEach(async () => {
        ;[deployer, user, user2, treasury] = await ethers.getSigners()
        collateralToken = await mockERC20Fixture(
            'prePO Collateral Token',
            'preCT'
        )
        await collateralToken.mint(deployer.address, MOCK_COLLATERAL_SUPPLY)
        prePOMarketFactory = await prePOMarketFactoryFixture()
    })

    describe('# initialize', () => {
        it('owner should be set to deployer', async () => {
            expect(await prePOMarketFactory.owner()).to.eq(deployer.address)
        })
    })

    describe('# setCollateralValidity', () => {
        it('should only be usable by the owner', async () => {
            await expect(
                prePOMarketFactory
                    .connect(user)
                    .setCollateralValidity(collateralToken.address, true)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should correctly set validity of collateral to true', async () => {
            expect(
                await prePOMarketFactory.isCollateralValid(
                    collateralToken.address
                )
            ).to.eq(false)

            await prePOMarketFactory
                .connect(deployer)
                .setCollateralValidity(collateralToken.address, true)

            expect(
                await prePOMarketFactory.isCollateralValid(
                    collateralToken.address
                )
            ).to.eq(true)
        })

        it('should correctly set validity of collateral to false', async () => {
            expect(
                await prePOMarketFactory.isCollateralValid(
                    collateralToken.address
                )
            ).to.eq(false)

            await prePOMarketFactory
                .connect(deployer)
                .setCollateralValidity(collateralToken.address, false)

            expect(
                await prePOMarketFactory.isCollateralValid(
                    collateralToken.address
                )
            ).to.eq(false)
        })

        it('should emit a CollateralValiditySet event', async () => {
            await prePOMarketFactory
                .connect(deployer)
                .setCollateralValidity(collateralToken.address, true)

            let collateralValidityChangedEvent =
                await getCollateralValidityChangedEvent(prePOMarketFactory)
            expect(await collateralValidityChangedEvent.collateral).to.eq(
                collateralToken.address
            )
            expect(await collateralValidityChangedEvent.allowed).to.eq(true)
        })
    })

    describe('# createMarket', () => {
        let defaultParams: CreateMarketParams
        let createMarket: (marketParams: CreateMarketParams) => Promise<string>

        beforeEach(async () => {
            await prePOMarketFactory.setCollateralValidity(
                collateralToken.address,
                true
            )
            defaultParams = {
                caller: deployer,
                factory: prePOMarketFactory,
                tokenNameSuffix: TEST_NAME_SUFFIX,
                tokenSymbolSuffix: TEST_SYMBOL_SUFFIX,
                collateral: collateralToken.address,
                governance: treasury.address,
                floorLongPrice: TEST_FLOOR_PRICE,
                ceilingLongPrice: TEST_CEILING_PRICE,
                floorValuation: TEST_FLOOR_VAL,
                ceilingValuation: TEST_CEILING_VAL,
                mintingFee: TEST_MINTING_FEE,
                redemptionFee: TEST_REDEMPTION_FEE,
                expiryTime: TEST_EXPIRY,
            }

            createMarket = async (marketParams) => {
                return await createMarketFixture(marketParams)
            }
        })

        it('should only be usable by the owner', async () => {
            await expect(
                createMarket({
                    ...defaultParams,
                    caller: user,
                })
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should not allow invalid collateral', async () => {
            let invalidCollateral = await mockERC20Fixture('Invalid', 'INVLD')

            await expect(
                createMarket({
                    ...defaultParams,
                    collateral: invalidCollateral.address,
                })
            ).revertedWith(revertReason('Invalid collateral'))
        })

        it('should deploy two LongShortToken contracts owned by the new prePOMarket', async () => {
            let prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let longToken = await LongShortTokenAttachFixture(
                await prePOMarket.getLongToken()
            )
            let shortToken = await LongShortTokenAttachFixture(
                await prePOMarket.getShortToken()
            )

            expect(await longToken.owner()).to.eq(prePOMarket.address)
            expect(await shortToken.owner()).to.eq(prePOMarket.address)
            expect(await longToken.name()).to.eq(
                'LONG preSTRIPE 100-200 30-September-2021'
            )
            expect(await shortToken.name()).to.eq(
                'SHORT preSTRIPE 100-200 30-September-2021'
            )
            expect(await longToken.symbol()).to.eq(
                'L_preSTRIPE_100-200_30SEP21'
            )
            expect(await shortToken.symbol()).to.eq(
                'S_preSTRIPE_100-200_30SEP21'
            )
        })

        it('should initialize a prePOMarket with the correct values', async () => {
            let prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let longToken = await LongShortTokenAttachFixture(
                await prePOMarket.getLongToken()
            )
            let shortToken = await LongShortTokenAttachFixture(
                await prePOMarket.getShortToken()
            )

            expect(await prePOMarket.getCollateral()).to.eq(
                collateralToken.address
            )
            expect(await prePOMarket.getTreasury()).to.eq(treasury.address)
            expect(await longToken.owner()).to.eq(prePOMarket.address)
            expect(await shortToken.owner()).to.eq(prePOMarket.address)
            expect(await prePOMarket.getFloorLongPrice()).to.eq(
                TEST_FLOOR_PRICE
            )
            expect(await prePOMarket.getCeilingLongPrice()).to.eq(
                TEST_CEILING_PRICE
            )
            expect(await prePOMarket.getMintingFee()).to.eq(TEST_MINTING_FEE)
            expect(await prePOMarket.getRedemptionFee()).to.eq(
                TEST_REDEMPTION_FEE
            )
            expect(await prePOMarket.isPublicMintingAllowed()).to.eq(false)
        })

        it('should generate the long/short hash correctly', async () => {
            let prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let marketHash = ethers.utils.solidityKeccak256(
                ['address', 'address'],
                [
                    await prePOMarket.getLongToken(),
                    await prePOMarket.getShortToken(),
                ]
            )

            expect(await prePOMarketFactory.getMarket(marketHash)).to.eq(
                prePOMarket.address
            )
        })
    })
})

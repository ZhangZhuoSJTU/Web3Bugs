import chai from 'chai'
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { MockERC20 } from '../typechain/MockERC20'
import { LongShortToken } from '../typechain/LongShortToken'
import { PrePOMarket } from '../typechain/PrePOMarket'
import { PrePOMarketFactory } from '../typechain/PrePOMarketFactory'
import { mockERC20Fixture } from './fixtures/MockERC20Fixture'
import {
    LongShortTokenFixture,
    LongShortTokenAttachFixture,
} from './fixtures/LongShortTokenFixture'
import {
    prePOMarketFixture,
    prePOMarketAttachFixture,
} from './fixtures/PrePOMarketFixture'
import {
    CreateMarketParams,
    prePOMarketFactoryFixture,
    createMarketFixture,
} from './fixtures/PrePOMarketFactoryFixture'
import {
    getMarketCreatedEvent,
    getPublicMintingChangedEvent,
    getMarketMintingFeeChangedEvent,
    getMarketRedemptionFeeChangedEvent,
    getTreasuryChangedEvent,
    getFinalLongPriceSetEvent,
} from './events'
import {
    AddressZero,
    nowPlusMonths,
    MAX_PRICE,
    calculateFee,
    FEE_LIMIT,
    mineBlock,
    FEE_DENOMINATOR,
    getLastTimestamp,
    revertReason,
} from './utils'
import { BigNumber } from 'ethers'

chai.use(solidity)

describe('=> prePOMarket', () => {
    let collateralToken: MockERC20
    let prePOMarket: PrePOMarket
    let prePOMarketFactory: PrePOMarketFactory
    let deployer: SignerWithAddress
    let user: SignerWithAddress
    let user2: SignerWithAddress
    let treasury: SignerWithAddress
    let defaultParams: CreateMarketParams
    let createMarket: (marketParams: CreateMarketParams) => Promise<string>
    const TEST_NAME_SUFFIX = 'preSTRIPE 100-200 30-September-2021'
    const TEST_SYMBOL_SUFFIX = 'preSTRIPE_100-200_30SEP21'
    const TEST_FLOOR_VAL = ethers.utils.parseEther('100')
    const TEST_CEILING_VAL = ethers.utils.parseEther('200')
    const TEST_MINTING_FEE = 10
    const TEST_REDEMPTION_FEE = 20
    const TEST_EXPIRY = nowPlusMonths(2)
    const TEST_FLOOR_PRICE = ethers.utils.parseEther('0.2')
    const TEST_CEILING_PRICE = ethers.utils.parseEther('0.8')
    const TEST_MINT_AMOUNT = ethers.utils.parseEther('1000')
    const TEST_FINAL_LONG_PRICE =
        TEST_FLOOR_PRICE.add(TEST_CEILING_PRICE).div(2)
    const MOCK_COLLATERAL_SUPPLY = ethers.utils.parseEther('1000000000')

    beforeEach(async () => {
        ;[deployer, user, user2, treasury] = await ethers.getSigners()
        collateralToken = await mockERC20Fixture(
            'prePO Collateral Token',
            'preCT'
        )
        await collateralToken.mint(deployer.address, MOCK_COLLATERAL_SUPPLY)
        prePOMarketFactory = await prePOMarketFactoryFixture()
        await prePOMarketFactory.setCollateralValidity(
            collateralToken.address,
            true
        )
        defaultParams = {
            caller: deployer,
            factory: prePOMarketFactory,
            tokenNameSuffix: TEST_NAME_SUFFIX,
            tokenSymbolSuffix: TEST_SYMBOL_SUFFIX,
            governance: treasury.address,
            collateral: collateralToken.address,
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

    describe('# initialize', () => {
        it('should be initialized with correct values', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let longToken = await LongShortTokenAttachFixture(
                await prePOMarket.getLongToken()
            )
            let shortToken = await LongShortTokenAttachFixture(
                await prePOMarket.getShortToken()
            )

            expect(await prePOMarket.getTreasury()).to.eq(treasury.address)
            expect(await prePOMarket.getCollateral()).to.eq(
                collateralToken.address
            )
            expect(await longToken.owner()).to.eq(prePOMarket.address)
            expect(await shortToken.owner()).to.eq(prePOMarket.address)
            expect(await prePOMarket.getFloorLongPrice()).to.eq(
                TEST_FLOOR_PRICE
            )
            expect(await prePOMarket.getCeilingLongPrice()).to.eq(
                TEST_CEILING_PRICE
            )
            expect(await prePOMarket.getFinalLongPrice()).to.eq(
                MAX_PRICE.add(1)
            )
            expect(await prePOMarket.getFloorValuation()).to.eq(TEST_FLOOR_VAL)
            expect(await prePOMarket.getCeilingValuation()).to.eq(
                TEST_CEILING_VAL
            )
            expect(await prePOMarket.getMintingFee()).to.eq(TEST_MINTING_FEE)
            expect(await prePOMarket.getRedemptionFee()).to.eq(
                TEST_REDEMPTION_FEE
            )
            expect(await prePOMarket.getExpiryTime()).to.eq(TEST_EXPIRY)
            expect(await prePOMarket.isPublicMintingAllowed()).to.eq(false)
            expect(await prePOMarket.getMaxPrice()).to.eq(MAX_PRICE)
            expect(await prePOMarket.getFeeDenominator()).to.eq(
                FEE_DENOMINATOR
            )
            expect(await prePOMarket.getFeeLimit()).to.eq(FEE_LIMIT)
        })

        it('should set owner to governance', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )

            expect(await prePOMarket.owner()).to.eq(treasury.address)
        })

        it('should not allow floor = ceiling', async () => {
            await expect(
                createMarket({
                    ...defaultParams,
                    ceilingLongPrice: TEST_FLOOR_PRICE,
                })
            ).revertedWith(revertReason('Ceiling must exceed floor'))
        })

        it('should not allow floor > ceiling', async () => {
            await expect(
                createMarket({
                    ...defaultParams,
                    floorLongPrice: TEST_CEILING_PRICE,
                    ceilingLongPrice: TEST_FLOOR_PRICE,
                })
            ).revertedWith(revertReason('Ceiling must exceed floor'))
        })

        it('should not allow ceiling >  1', async () => {
            await expect(
                createMarket({
                    ...defaultParams,
                    ceilingLongPrice: MAX_PRICE.add(1),
                })
            ).revertedWith(revertReason('Ceiling cannot exceed 1'))
        })

        it('should not allow expiry before current time', async () => {
            let lastTimestamp = await getLastTimestamp()

            await expect(
                createMarket({
                    ...defaultParams,
                    expiryTime: lastTimestamp - 1,
                })
            ).revertedWith(revertReason('Invalid expiry'))
        })

        it('should not allow expiry at current time', async () => {
            let lastTimestamp = await getLastTimestamp()

            await expect(
                createMarket({
                    ...defaultParams,
                    expiryTime: lastTimestamp,
                })
            ).revertedWith(revertReason('Invalid expiry'))
        })

        it('should not allow setting minting fee above FEE_LIMIT ', async () => {
            let aboveFeeLimit = FEE_LIMIT + 1

            await expect(
                createMarket({
                    ...defaultParams,
                    mintingFee: aboveFeeLimit,
                })
            ).revertedWith(revertReason('Exceeds fee limit'))
        })

        it('should allow setting minting fee to FEE_LIMIT ', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket({
                    ...defaultParams,
                    mintingFee: FEE_LIMIT,
                })
            )

            expect(await prePOMarket.getMintingFee()).to.eq(FEE_LIMIT)
        })

        it('should not allow setting redemption fee above FEE_LIMIT ', async () => {
            let aboveFeeLimit = FEE_LIMIT + 1

            await expect(
                createMarket({
                    ...defaultParams,
                    redemptionFee: aboveFeeLimit,
                })
            ).revertedWith(revertReason('Exceeds fee limit'))
        })

        it('should allow setting redemption fee to FEE_LIMIT ', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket({
                    ...defaultParams,
                    redemptionFee: FEE_LIMIT,
                })
            )

            expect(await prePOMarket.getRedemptionFee()).to.eq(FEE_LIMIT)
        })

        it('should emit MarketCreated event', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let marketCreatedEvent = await getMarketCreatedEvent(prePOMarket)

            expect(await prePOMarket.getLongToken()).to.eq(
                marketCreatedEvent.longToken
            )
            expect(await prePOMarket.getShortToken()).to.eq(
                marketCreatedEvent.shortToken
            )
            expect(await prePOMarket.getFloorLongPrice()).to.eq(
                marketCreatedEvent.floorLongPrice
            )
            expect(await prePOMarket.getCeilingLongPrice()).to.eq(
                marketCreatedEvent.ceilingLongPrice
            )
            expect(TEST_FLOOR_VAL).to.eq(marketCreatedEvent.floorValuation)
            expect(TEST_CEILING_VAL).to.eq(marketCreatedEvent.ceilingValuation)
            expect(await prePOMarket.getMintingFee()).to.eq(
                marketCreatedEvent.mintingFee
            )
            expect(await prePOMarket.getRedemptionFee()).to.eq(
                marketCreatedEvent.redemptionFee
            )
            expect(TEST_EXPIRY).to.eq(marketCreatedEvent.expiryTime)
        })
    })

    describe('# setFinalLongPrice', () => {
        beforeEach(async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
        })

        it('should only be usable by the owner', async () => {
            await expect(
                prePOMarket.connect(user).setFinalLongPrice(MAX_PRICE)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should not be settable beyond ceiling', async () => {
            await expect(
                prePOMarket
                    .connect(treasury)
                    .setFinalLongPrice(TEST_CEILING_PRICE.add(1))
            ).to.revertedWith(revertReason('Price cannot exceed ceiling'))
        })

        it('should not be settable below floor', async () => {
            await expect(
                prePOMarket
                    .connect(treasury)
                    .setFinalLongPrice(TEST_FLOOR_PRICE.sub(1))
            ).to.revertedWith(revertReason('Price cannot be below floor'))
        })

        it('should be settable to value between price and ceiling', async () => {
            await prePOMarket
                .connect(treasury)
                .setFinalLongPrice(TEST_CEILING_PRICE.sub(1))

            expect(await prePOMarket.getFinalLongPrice()).to.eq(
                TEST_CEILING_PRICE.sub(1)
            )
        })

        it('should correctly set the same value twice', async () => {
            await prePOMarket
                .connect(treasury)
                .setFinalLongPrice(TEST_CEILING_PRICE.sub(1))

            expect(await prePOMarket.getFinalLongPrice()).to.eq(
                TEST_CEILING_PRICE.sub(1)
            )

            await prePOMarket
                .connect(treasury)
                .setFinalLongPrice(TEST_CEILING_PRICE.sub(1))

            expect(await prePOMarket.getFinalLongPrice()).to.eq(
                TEST_CEILING_PRICE.sub(1)
            )
        })

        it('should emit a FinalLongPriceSet event', async () => {
            await prePOMarket
                .connect(treasury)
                .setFinalLongPrice(TEST_CEILING_PRICE.sub(1))
            let finalLongPriceSetEvent = await getFinalLongPriceSetEvent(
                prePOMarket
            )

            expect(finalLongPriceSetEvent.price).to.eq(
                TEST_CEILING_PRICE.sub(1)
            )
        })
    })

    describe('# setTreasury', () => {
        beforeEach(async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
        })

        it('should only be usable by the owner', async () => {
            await expect(
                prePOMarket.connect(user).setTreasury(user.address)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should be settable to a non-zero address', async () => {
            expect(await prePOMarket.getTreasury()).to.not.eq(user.address)

            await prePOMarket.connect(treasury).setTreasury(user.address)

            expect(await prePOMarket.getTreasury()).to.eq(user.address)
        })

        it('should be settable to the zero address', async () => {
            expect(await prePOMarket.getTreasury()).to.not.eq(AddressZero)

            await prePOMarket.connect(treasury).setTreasury(AddressZero)

            expect(await prePOMarket.getTreasury()).to.eq(AddressZero)
        })

        it('should be settable to the same value twice', async () => {
            expect(await prePOMarket.getTreasury()).to.not.eq(user.address)

            await prePOMarket.connect(treasury).setTreasury(user.address)

            expect(await prePOMarket.getTreasury()).to.eq(user.address)

            await prePOMarket.connect(treasury).setTreasury(user.address)

            expect(await prePOMarket.getTreasury()).to.eq(user.address)
        })

        it('should emit a TreasuryChanged event', async () => {
            await prePOMarket.connect(treasury).setTreasury(user.address)

            let treasuryChangedEvent = await getTreasuryChangedEvent(
                prePOMarket
            )
            expect(treasuryChangedEvent.treasury).to.eq(user.address)
        })
    })

    describe('# setMintingFee', () => {
        beforeEach(async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
        })

        it('should only be usable by the owner', async () => {
            await expect(
                prePOMarket.connect(user).setMintingFee(FEE_LIMIT - 1)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should not be settable beyond FEE_LIMIT', async () => {
            await expect(
                prePOMarket.connect(treasury).setMintingFee(FEE_LIMIT + 1)
            ).to.revertedWith(revertReason('Exceeds fee limit'))
        })

        it('should be settable to FEE_LIMIT', async () => {
            await prePOMarket.connect(treasury).setMintingFee(FEE_LIMIT)
            expect(await prePOMarket.getMintingFee()).to.eq(FEE_LIMIT)
        })

        it('should be settable below FEE_LIMIT', async () => {
            await prePOMarket.connect(treasury).setMintingFee(FEE_LIMIT - 1)
            expect(await prePOMarket.getMintingFee()).to.eq(FEE_LIMIT - 1)
        })

        it('should be settable to zero', async () => {
            await prePOMarket.connect(treasury).setMintingFee(0)
            expect(await prePOMarket.getMintingFee()).to.eq(0)
        })

        it('should correctly set the same value twice', async () => {
            await prePOMarket.connect(treasury).setMintingFee(FEE_LIMIT - 1)
            expect(await prePOMarket.getMintingFee()).to.eq(FEE_LIMIT - 1)
            await prePOMarket.connect(treasury).setMintingFee(FEE_LIMIT - 1)
            expect(await prePOMarket.getMintingFee()).to.eq(FEE_LIMIT - 1)
        })

        it('should emit a MintingFeeChanged event', async () => {
            await prePOMarket.connect(treasury).setMintingFee(FEE_LIMIT)

            let mintingFeeChangedEvent = await getMarketMintingFeeChangedEvent(
                prePOMarket
            )
            expect(mintingFeeChangedEvent.fee).to.eq(FEE_LIMIT)
        })
    })

    describe('# setRedemptionFee', () => {
        beforeEach(async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
        })

        it('should only be usable by the owner', async () => {
            await expect(
                prePOMarket.connect(user).setRedemptionFee(FEE_LIMIT - 1)
            ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should not be settable beyond FEE_LIMIT', async () => {
            await expect(
                prePOMarket.connect(treasury).setRedemptionFee(FEE_LIMIT + 1)
            ).to.revertedWith(revertReason('Exceeds fee limit'))
        })

        it('should be settable to FEE_LIMIT', async () => {
            await prePOMarket.connect(treasury).setRedemptionFee(FEE_LIMIT)
            expect(await prePOMarket.getRedemptionFee()).to.eq(FEE_LIMIT)
        })

        it('should be settable below FEE_LIMIT', async () => {
            await prePOMarket.connect(treasury).setRedemptionFee(FEE_LIMIT - 1)
            expect(await prePOMarket.getRedemptionFee()).to.eq(FEE_LIMIT - 1)
        })

        it('should be settable to zero', async () => {
            await prePOMarket.connect(treasury).setRedemptionFee(0)
            expect(await prePOMarket.getRedemptionFee()).to.eq(0)
        })

        it('should emit a RedemptionFeeChanged event', async () => {
            await prePOMarket.connect(treasury).setRedemptionFee(FEE_LIMIT)

            let redemptionFeeChangedEvent =
                await getMarketRedemptionFeeChangedEvent(prePOMarket)
            expect(redemptionFeeChangedEvent.fee).to.eq(FEE_LIMIT)
        })
    })

    describe('# setPublicMinting', () => {
        beforeEach(async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
        })

        it('should only be usable by the owner', async () => {
            await expect(
                prePOMarket.connect(deployer).setPublicMinting(true)
            ).revertedWith(revertReason('Ownable: caller is not the owner'))
        })

        it('should set the publicMinting field to true correctly', async () => {
            await prePOMarket.connect(treasury).setPublicMinting(true)

            expect(await prePOMarket.isPublicMintingAllowed()).to.eq(true)
        })

        it('should set the publicMinting field to false correctly', async () => {
            await prePOMarket.connect(treasury).setPublicMinting(false)

            expect(await prePOMarket.isPublicMintingAllowed()).to.eq(false)
        })

        it('should emit a PublicMintingSet event', async () => {
            await prePOMarket.connect(treasury).setPublicMinting(true)

            let publicMintingEvent = await getPublicMintingChangedEvent(
                prePOMarket
            )
            expect(publicMintingEvent.allowed).to.eq(true)
        })
    })

    describe('# mintLongShortTokens', () => {
        it('should not allow minting after market end', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            await collateralToken
                .connect(deployer)
                .transfer(user.address, TEST_MINT_AMOUNT)
            await collateralToken
                .connect(user)
                .approve(prePOMarket.address, TEST_MINT_AMOUNT)
            await prePOMarket.connect(treasury).setPublicMinting(true)
            await prePOMarket
                .connect(treasury)
                .setFinalLongPrice(TEST_FINAL_LONG_PRICE)

            await expect(
                prePOMarket.connect(user).mintLongShortTokens(TEST_MINT_AMOUNT)
            ).revertedWith(revertReason('Market ended'))
        })

        it('should not allow minting when public minting is disabled', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )

            await expect(
                prePOMarket.connect(user).mintLongShortTokens(TEST_MINT_AMOUNT)
            ).revertedWith(revertReason('Public minting disabled'))
        })

        it('should not allow minting amount too small for fee', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            await collateralToken.connect(deployer).transfer(user.address, 1)
            await collateralToken.connect(user).approve(prePOMarket.address, 1)
            await prePOMarket.connect(treasury).setPublicMinting(true)

            await expect(
                prePOMarket.connect(user).mintLongShortTokens(1)
            ).to.revertedWith(revertReason('Minting amount too small'))
        })

        it('should not allow minting an amount exceeding owned collateral', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            await collateralToken
                .connect(deployer)
                .transfer(user.address, TEST_MINT_AMOUNT.sub(1))
            await collateralToken
                .connect(user)
                .approve(prePOMarket.address, TEST_MINT_AMOUNT.sub(1))
            await prePOMarket.connect(treasury).setPublicMinting(true)

            await expect(
                prePOMarket.connect(user).mintLongShortTokens(TEST_MINT_AMOUNT)
            ).revertedWith(revertReason('Insufficient collateral'))
        })

        it('should distribute paid collateral correctly to treasury and market', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            await collateralToken
                .connect(deployer)
                .transfer(user.address, TEST_MINT_AMOUNT)
            await collateralToken
                .connect(user)
                .approve(prePOMarket.address, TEST_MINT_AMOUNT)
            let fee = calculateFee(
                TEST_MINT_AMOUNT,
                await prePOMarket.getMintingFee()
            )
            await prePOMarket.connect(treasury).setPublicMinting(true)

            await prePOMarket
                .connect(user)
                .mintLongShortTokens(TEST_MINT_AMOUNT)

            expect(await collateralToken.balanceOf(treasury.address)).to.eq(
                fee
            )
            expect(await collateralToken.balanceOf(prePOMarket.address)).to.eq(
                TEST_MINT_AMOUNT.sub(fee)
            )
        })

        it('should mint the right amount of long and short tokens', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let longToken = await LongShortTokenAttachFixture(
                await prePOMarket.getLongToken()
            )
            let shortToken = await LongShortTokenAttachFixture(
                await prePOMarket.getShortToken()
            )
            await collateralToken
                .connect(deployer)
                .transfer(user.address, TEST_MINT_AMOUNT)
            await collateralToken
                .connect(user)
                .approve(prePOMarket.address, TEST_MINT_AMOUNT)
            let fee = calculateFee(
                TEST_MINT_AMOUNT,
                await prePOMarket.getMintingFee()
            )
            await prePOMarket.connect(treasury).setPublicMinting(true)

            await prePOMarket
                .connect(user)
                .mintLongShortTokens(TEST_MINT_AMOUNT)

            expect(await longToken.balanceOf(user.address)).to.eq(
                TEST_MINT_AMOUNT.sub(fee)
            )
            expect(await shortToken.balanceOf(user.address)).to.eq(
                TEST_MINT_AMOUNT.sub(fee)
            )
        })

        it('should emit a Mint event indexed by minter', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            await collateralToken
                .connect(deployer)
                .transfer(user.address, TEST_MINT_AMOUNT)
            await collateralToken
                .connect(user)
                .approve(prePOMarket.address, TEST_MINT_AMOUNT)
            let fee = calculateFee(
                TEST_MINT_AMOUNT,
                await prePOMarket.getMintingFee()
            )
            await prePOMarket.connect(treasury).setPublicMinting(true)
            await prePOMarket
                .connect(user)
                .mintLongShortTokens(TEST_MINT_AMOUNT)

            let mintFilter = {
                address: prePOMarket.address,
                topics: [
                    ethers.utils.id('Mint(address,uint256)'),
                    ethers.utils.hexZeroPad(user.address, 32),
                ],
            }
            let mintEvents = await prePOMarket.queryFilter(mintFilter)
            let mintEvent = mintEvents[0].args as any

            expect(await mintEvent.minter).to.eq(user.address)
            expect(await mintEvent.amount).to.eq(TEST_MINT_AMOUNT.sub(fee))
        })

        it('should allow owner to mint when public minting is disabled', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let longToken = await LongShortTokenAttachFixture(
                await prePOMarket.getLongToken()
            )
            let shortToken = await LongShortTokenAttachFixture(
                await prePOMarket.getShortToken()
            )
            await collateralToken
                .connect(deployer)
                .transfer(treasury.address, TEST_MINT_AMOUNT)
            await collateralToken
                .connect(treasury)
                .approve(prePOMarket.address, TEST_MINT_AMOUNT)
            let fee = calculateFee(
                TEST_MINT_AMOUNT,
                await prePOMarket.getMintingFee()
            )
            await prePOMarket.connect(treasury).setPublicMinting(false)

            await prePOMarket
                .connect(treasury)
                .mintLongShortTokens(TEST_MINT_AMOUNT)

            expect(await longToken.balanceOf(treasury.address)).to.eq(
                TEST_MINT_AMOUNT.sub(fee)
            )
            expect(await shortToken.balanceOf(treasury.address)).to.eq(
                TEST_MINT_AMOUNT.sub(fee)
            )
        })

        it('should return the number of tokens minted', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            await collateralToken
                .connect(deployer)
                .transfer(user.address, TEST_MINT_AMOUNT)
            await collateralToken
                .connect(user)
                .approve(prePOMarket.address, TEST_MINT_AMOUNT)
            let fee = calculateFee(
                TEST_MINT_AMOUNT,
                await prePOMarket.getMintingFee()
            )
            await prePOMarket.connect(treasury).setPublicMinting(true)

            expect(
                await prePOMarket
                    .connect(user)
                    .callStatic.mintLongShortTokens(TEST_MINT_AMOUNT)
            ).to.eq(TEST_MINT_AMOUNT.sub(fee))
        })
    })

    describe('# redeem', () => {
        let calculateTotalOwed: (
            longToRedeem: BigNumber,
            shortToRedeem: BigNumber,
            finalPriceSet: boolean
        ) => Promise<BigNumber>
        let mintTestPosition: () => Promise<BigNumber>
        let approveTokensForRedemption: (
            owner: SignerWithAddress,
            amount: BigNumber
        ) => Promise<void>
        let setupMarket: () => Promise<BigNumber>
        let setupMarketToEnd: (finalLongPrice: BigNumber) => Promise<BigNumber>
        let longToken: LongShortToken
        let shortToken: LongShortToken

        beforeEach(async () => {
            mintTestPosition = async () => {
                await collateralToken
                    .connect(deployer)
                    .transfer(user.address, TEST_MINT_AMOUNT)
                await collateralToken
                    .connect(user)
                    .approve(prePOMarket.address, TEST_MINT_AMOUNT)
                await prePOMarket.connect(treasury).setPublicMinting(true)
                await prePOMarket
                    .connect(user)
                    .mintLongShortTokens(TEST_MINT_AMOUNT)
                let mintFee = calculateFee(
                    TEST_MINT_AMOUNT,
                    await prePOMarket.getMintingFee()
                )
                return TEST_MINT_AMOUNT.sub(mintFee)
            }

            // TODO: need to implement a way to remove the need for approval calls, perhaps using permit signatures?
            approveTokensForRedemption = async (
                owner: SignerWithAddress,
                amount: BigNumber
            ) => {
                longToken = await LongShortTokenAttachFixture(
                    await prePOMarket.getLongToken()
                )
                shortToken = await LongShortTokenAttachFixture(
                    await prePOMarket.getShortToken()
                )
                await longToken
                    .connect(owner)
                    .approve(prePOMarket.address, amount)
                await shortToken
                    .connect(owner)
                    .approve(prePOMarket.address, amount)
            }

            setupMarket = async () => {
                prePOMarket = await prePOMarketAttachFixture(
                    await createMarket(defaultParams)
                )
                let amountMinted = await mintTestPosition()
                await approveTokensForRedemption(user, amountMinted)
                return amountMinted
            }

            setupMarketToEnd = async (finalLongPrice: BigNumber) => {
                prePOMarket = await prePOMarketAttachFixture(
                    await createMarket(defaultParams)
                )
                let amountMinted = await mintTestPosition()
                await approveTokensForRedemption(user, amountMinted)
                await prePOMarket
                    .connect(treasury)
                    .setFinalLongPrice(finalLongPrice)
                return amountMinted
            }

            calculateTotalOwed = async (
                longToRedeem: BigNumber,
                shortToRedeem: BigNumber,
                finalPriceSet: boolean
            ) => {
                let totalOwed: BigNumber
                if (finalPriceSet) {
                    totalOwed = longToRedeem
                } else {
                    let owedForLongs = longToRedeem
                        .mul(await prePOMarket.getFinalLongPrice())
                        .div(MAX_PRICE)
                    let owedForShort = shortToRedeem
                        .mul(
                            MAX_PRICE.sub(
                                await prePOMarket.getFinalLongPrice()
                            )
                        )
                        .div(MAX_PRICE)
                    totalOwed = owedForLongs.add(owedForShort)
                }
                return totalOwed
            }
        })

        it('should not allow long token redemption exceeding long token balance', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let amountMinted = await mintTestPosition()

            await expect(
                prePOMarket
                    .connect(user)
                    .redeem(amountMinted.add(1), amountMinted)
            ).revertedWith(revertReason('Insufficient long tokens'))
        })

        it('should not allow short token redemption exceeding short token balance', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let amountMinted = await mintTestPosition()

            await expect(
                prePOMarket
                    .connect(user)
                    .redeem(amountMinted, amountMinted.add(1))
            ).revertedWith(revertReason('Insufficient short tokens'))
        })

        it('should only allow token redemption in equal parts before expiry', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let amountMinted = await mintTestPosition()

            await expect(
                prePOMarket
                    .connect(user)
                    .redeem(amountMinted, amountMinted.sub(1))
            ).revertedWith(revertReason('Long and Short must be equal'))
        })

        it('should correctly settle equal non-zero redemption amounts before market end', async () => {
            let amountMinted = await setupMarket()
            let longToRedeem = amountMinted
            let shortToRedeem = amountMinted
            let totalOwed = await calculateTotalOwed(
                longToRedeem,
                shortToRedeem,
                false
            )
            let redeemFee = calculateFee(
                totalOwed,
                await prePOMarket.getRedemptionFee()
            )
            let treasuryBefore = await collateralToken.balanceOf(
                treasury.address
            )

            await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

            expect(await longToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(longToRedeem)
            )
            expect(await shortToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(shortToRedeem)
            )
            expect(await collateralToken.balanceOf(treasury.address)).to.eq(
                treasuryBefore.add(redeemFee)
            )
            expect(await collateralToken.balanceOf(user.address)).to.eq(
                totalOwed.sub(redeemFee)
            )
        })

        it('should correctly settle non-equal non-zero redemption amounts after market end', async () => {
            let amountMinted = await setupMarketToEnd(TEST_FINAL_LONG_PRICE)
            let longToRedeem = amountMinted
            let shortToRedeem = amountMinted.sub(1)
            let totalOwed = await calculateTotalOwed(
                longToRedeem,
                shortToRedeem,
                false
            )
            let redeemFee = calculateFee(
                totalOwed,
                await prePOMarket.getRedemptionFee()
            )
            let treasuryBefore = await collateralToken.balanceOf(
                treasury.address
            )

            await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

            expect(await longToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(longToRedeem)
            )
            expect(await shortToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(shortToRedeem)
            )
            expect(await collateralToken.balanceOf(treasury.address)).to.eq(
                treasuryBefore.add(redeemFee)
            )
            expect(await collateralToken.balanceOf(user.address)).to.eq(
                totalOwed.sub(redeemFee)
            )
        })

        it('should correctly settle redemption done with only long tokens after market end', async () => {
            let amountMinted = await setupMarketToEnd(TEST_FINAL_LONG_PRICE)
            let longToRedeem = amountMinted
            let shortToRedeem = ethers.utils.parseEther('0')
            let totalOwed = await calculateTotalOwed(
                longToRedeem,
                shortToRedeem,
                false
            )
            let redeemFee = calculateFee(
                totalOwed,
                await prePOMarket.getRedemptionFee()
            )
            let treasuryBefore = await collateralToken.balanceOf(
                treasury.address
            )

            await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

            expect(await longToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(longToRedeem)
            )
            expect(await shortToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(shortToRedeem)
            )
            expect(await collateralToken.balanceOf(treasury.address)).to.eq(
                treasuryBefore.add(redeemFee)
            )
            expect(await collateralToken.balanceOf(user.address)).to.eq(
                totalOwed.sub(redeemFee)
            )
        })

        it('should correctly settle redemption done with only short tokens after market end', async () => {
            let amountMinted = await setupMarketToEnd(TEST_FINAL_LONG_PRICE)
            let longToRedeem = ethers.utils.parseEther('0')
            let shortToRedeem = amountMinted
            let totalOwed = await calculateTotalOwed(
                longToRedeem,
                shortToRedeem,
                false
            )
            let redeemFee = calculateFee(
                totalOwed,
                await prePOMarket.getRedemptionFee()
            )
            let treasuryBefore = await collateralToken.balanceOf(
                treasury.address
            )

            await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

            expect(await longToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(longToRedeem)
            )
            expect(await shortToken.balanceOf(user.address)).to.eq(
                amountMinted.sub(shortToRedeem)
            )
            expect(await collateralToken.balanceOf(treasury.address)).to.eq(
                treasuryBefore.add(redeemFee)
            )
            expect(await collateralToken.balanceOf(user.address)).to.eq(
                totalOwed.sub(redeemFee)
            )
        })

        it('should not allow redemption amounts too small for a fee before market end', async () => {
            let amountMinted = await setupMarket()
            let longToRedeem = ethers.utils.parseEther('0')
            let shortToRedeem = ethers.utils.parseEther('0')

            await expect(
                prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)
            ).revertedWith(revertReason('Redemption amount too small'))
        })

        it('should not allow redemption amounts too small for a fee after market end', async () => {
            let amountMinted = await setupMarketToEnd(TEST_FINAL_LONG_PRICE)
            let longToRedeem = ethers.utils.parseEther('0')
            let shortToRedeem = ethers.utils.parseEther('0')

            await expect(
                prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)
            ).revertedWith(revertReason('Redemption amount too small'))
        })

        it('should emit a Redemption event indexed by redeemer', async () => {
            prePOMarket = await prePOMarketAttachFixture(
                await createMarket(defaultParams)
            )
            let amountMinted = await mintTestPosition()
            await approveTokensForRedemption(user, amountMinted)
            let redeemFee = calculateFee(
                amountMinted,
                await prePOMarket.getRedemptionFee()
            )

            await prePOMarket.connect(user).redeem(amountMinted, amountMinted)

            let filter = {
                address: prePOMarket.address,
                topics: [
                    ethers.utils.id('Redemption(address,uint256)'),
                    ethers.utils.hexZeroPad(user.address, 32),
                ],
            }
            let events = await prePOMarket.queryFilter(filter)
            let event = events[0].args as any
            expect(await event.redeemer).to.eq(user.address)
            expect(await event.amount).to.eq(amountMinted.sub(redeemFee))
        })
    })
})

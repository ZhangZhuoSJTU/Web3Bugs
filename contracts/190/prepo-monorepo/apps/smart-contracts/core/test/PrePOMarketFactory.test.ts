import { expect } from 'chai'
import { ethers } from 'hardhat'
import { utils } from 'prepo-hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { formatBytes32String } from 'ethers/lib/utils'
import { testERC20Fixture } from './fixtures/TestERC20Fixture'
import { LongShortTokenAttachFixture } from './fixtures/LongShortTokenFixture'
import { prePOMarketAttachFixture } from './fixtures/PrePOMarketFixture'
import {
  CreateMarketParams,
  prePOMarketFactoryFixture,
  createMarketFixture,
  CreateMarketResult,
} from './fixtures/PrePOMarketFactoryFixture'
import { PrePOMarketFactory } from '../typechain/PrePOMarketFactory'
import { TestERC20 } from '../typechain/TestERC20'

const { nowPlusMonths, revertReason } = utils

describe('=> PrePOMarketFactory', () => {
  let prePOMarketFactory: PrePOMarketFactory
  let collateralToken: TestERC20
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let treasury: SignerWithAddress
  const TEST_NAME_SUFFIX = 'preSTRIPE 100-200 30-September-2021'
  const TEST_SYMBOL_SUFFIX = 'preSTRIPE_100-200_30SEP21'
  const TEST_FLOOR_VAL = ethers.utils.parseEther('100')
  const TEST_CEILING_VAL = ethers.utils.parseEther('200')
  const TEST_REDEMPTION_FEE = 20
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_FLOOR_PRICE = ethers.utils.parseEther('0.2')
  const TEST_CEILING_PRICE = ethers.utils.parseEther('0.8')
  const MOCK_COLLATERAL_SUPPLY = ethers.utils.parseEther('1000000000')

  beforeEach(async () => {
    ;[deployer, user, user2, treasury] = await ethers.getSigners()
    collateralToken = await testERC20Fixture('prePO USDC Collateral', 'preUSD', 18)
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
        prePOMarketFactory.connect(user).setCollateralValidity(collateralToken.address, true)
      ).revertedWith(revertReason('Ownable: caller is not the owner'))
    })

    it('should correctly set validity of collateral to true', async () => {
      expect(await prePOMarketFactory.isCollateralValid(collateralToken.address)).to.eq(false)

      await prePOMarketFactory
        .connect(deployer)
        .setCollateralValidity(collateralToken.address, true)

      expect(await prePOMarketFactory.isCollateralValid(collateralToken.address)).to.eq(true)
    })

    it('should correctly set validity of collateral to false', async () => {
      expect(await prePOMarketFactory.isCollateralValid(collateralToken.address)).to.eq(false)

      await prePOMarketFactory
        .connect(deployer)
        .setCollateralValidity(collateralToken.address, false)

      expect(await prePOMarketFactory.isCollateralValid(collateralToken.address)).to.eq(false)
    })

    it('should emit a CollateralValidityChanged event', async () => {
      const tx = await prePOMarketFactory
        .connect(deployer)
        .setCollateralValidity(collateralToken.address, true)

      await expect(tx)
        .to.emit(prePOMarketFactory, 'CollateralValidityChanged')
        .withArgs(collateralToken.address, true)
    })
  })

  describe('# createMarket', () => {
    let defaultParams: CreateMarketParams
    let createMarket: (marketParams: CreateMarketParams) => Promise<CreateMarketResult>

    beforeEach(async () => {
      await prePOMarketFactory.setCollateralValidity(collateralToken.address, true)
      defaultParams = {
        caller: deployer,
        factory: prePOMarketFactory,
        tokenNameSuffix: TEST_NAME_SUFFIX,
        tokenSymbolSuffix: TEST_SYMBOL_SUFFIX,
        longTokenSalt: formatBytes32String('DEFAULT_SALT'),
        shortTokenSalt: formatBytes32String('DEFAULT_SALT'),
        collateral: collateralToken.address,
        governance: treasury.address,
        floorLongPayout: TEST_FLOOR_PRICE,
        ceilingLongPayout: TEST_CEILING_PRICE,
        floorValuation: TEST_FLOOR_VAL,
        ceilingValuation: TEST_CEILING_VAL,
        expiryTime: TEST_EXPIRY,
      }

      createMarket = async (marketParams): Promise<CreateMarketResult> => {
        const result = await createMarketFixture(marketParams)
        return result
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
      const invalidCollateral = await testERC20Fixture('Invalid', 'INVLD', 18)

      await expect(
        createMarket({
          ...defaultParams,
          collateral: invalidCollateral.address,
        })
      ).revertedWith(revertReason('Invalid collateral'))
    })

    it('should emit MarketAdded event on market creation', async () => {
      const createMarketResult = await createMarket(defaultParams)
      await expect(createMarketResult.tx).to.emit(prePOMarketFactory, 'MarketAdded')
    })

    it('should deploy two LongShortToken contracts owned by the new prePOMarket', async () => {
      const prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())

      expect(await longToken.owner()).to.eq(prePOMarket.address)
      expect(await shortToken.owner()).to.eq(prePOMarket.address)
      expect(await longToken.name()).to.eq('LONG preSTRIPE 100-200 30-September-2021')
      expect(await shortToken.name()).to.eq('SHORT preSTRIPE 100-200 30-September-2021')
      expect(await longToken.symbol()).to.eq('L_preSTRIPE_100-200_30SEP21')
      expect(await shortToken.symbol()).to.eq('S_preSTRIPE_100-200_30SEP21')
    })

    it('uses `longTokenSalt` to generate the Long token contract address', async () => {
      const prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const longShortTokenFactory = await ethers.getContractFactory('LongShortToken')
      const longTokenDeployTx = longShortTokenFactory.getDeployTransaction(
        `LONG ${defaultParams.tokenNameSuffix}`,
        `L_${defaultParams.tokenSymbolSuffix}`
      )
      const hashedInitCode = ethers.utils.keccak256(longTokenDeployTx.data)

      expect(await prePOMarket.getLongToken()).to.eq(
        ethers.utils.getCreate2Address(
          prePOMarketFactory.address,
          defaultParams.longTokenSalt,
          hashedInitCode
        )
      )
    })

    it('uses `shortTokenSalt` to generate the Short token contract address', async () => {
      const prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const longShortTokenFactory = await ethers.getContractFactory('LongShortToken')
      const shortTokenDeployTx = longShortTokenFactory.getDeployTransaction(
        `SHORT ${defaultParams.tokenNameSuffix}`,
        `S_${defaultParams.tokenSymbolSuffix}`
      )
      const hashedInitCode = ethers.utils.keccak256(shortTokenDeployTx.data)

      expect(await prePOMarket.getShortToken()).to.eq(
        ethers.utils.getCreate2Address(
          prePOMarketFactory.address,
          defaultParams.shortTokenSalt,
          hashedInitCode
        )
      )
    })

    it('should initialize a prePOMarket with the correct values', async () => {
      const prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())

      expect(await prePOMarket.getCollateral()).to.eq(collateralToken.address)
      expect(await longToken.owner()).to.eq(prePOMarket.address)
      expect(await shortToken.owner()).to.eq(prePOMarket.address)
      expect(await prePOMarket.getFloorLongPayout()).to.eq(TEST_FLOOR_PRICE)
      expect(await prePOMarket.getCeilingLongPayout()).to.eq(TEST_CEILING_PRICE)
      expect(await prePOMarket.getRedemptionFee()).to.eq(0)
    })

    it('should generate the long/short hash correctly', async () => {
      const prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const marketHash = ethers.utils.solidityKeccak256(
        ['address', 'address'],
        [await prePOMarket.getLongToken(), await prePOMarket.getShortToken()]
      )

      expect(await prePOMarketFactory.getMarket(marketHash)).to.eq(prePOMarket.address)
    })
  })
})

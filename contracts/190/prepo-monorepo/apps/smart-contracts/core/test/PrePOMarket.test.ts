import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { BigNumber, Contract } from 'ethers'
import { formatBytes32String } from 'ethers/lib/utils'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { testERC20Fixture } from './fixtures/TestERC20Fixture'
import { LongShortTokenAttachFixture } from './fixtures/LongShortTokenFixture'
import { prePOMarketAttachFixture } from './fixtures/PrePOMarketFixture'
import {
  CreateMarketParams,
  prePOMarketFactoryFixture,
  createMarketFixture,
  CreateMarketResult,
} from './fixtures/PrePOMarketFactoryFixture'
import { fakeMintHookFixture } from './fixtures/HookFixture'
import {
  MAX_PAYOUT,
  calculateFee,
  MARKET_FEE_LIMIT,
  FEE_DENOMINATOR,
  getLastTimestamp,
} from './utils'
import { PrePOMarketFactory } from '../typechain/PrePOMarketFactory'
import { PrePOMarket } from '../typechain/PrePOMarket'
import { LongShortToken } from '../typechain/LongShortToken'
import { TestERC20 } from '../typechain/TestERC20'

chai.use(smock.matchers)

const { nowPlusMonths, revertReason } = utils

describe('=> prePOMarket', () => {
  let collateralToken: TestERC20
  let prePOMarket: PrePOMarket
  let prePOMarketFactory: PrePOMarketFactory
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let treasury: SignerWithAddress
  let defaultParams: CreateMarketParams
  const TEST_NAME_SUFFIX = 'preSTRIPE 100-200 30-September-2021'
  const TEST_SYMBOL_SUFFIX = 'preSTRIPE_100-200_30SEP21'
  const TEST_FLOOR_VAL = ethers.utils.parseEther('100')
  const TEST_CEILING_VAL = ethers.utils.parseEther('200')
  const TEST_REDEMPTION_FEE = 20
  const TEST_EXPIRY = nowPlusMonths(2)
  const TEST_FLOOR_PAYOUT = ethers.utils.parseEther('0.2')
  const TEST_CEILING_PAYOUT = ethers.utils.parseEther('0.8')
  const TEST_MINT_AMOUNT = ethers.utils.parseEther('1000')
  const TEST_FINAL_LONG_PAYOUT = TEST_FLOOR_PAYOUT.add(TEST_CEILING_PAYOUT).div(2)
  const MOCK_COLLATERAL_SUPPLY = ethers.utils.parseEther('1000000000')

  const createMarket = async (marketParams): Promise<CreateMarketResult> => {
    const createMarketResult = await createMarketFixture(marketParams)
    return createMarketResult
  }

  beforeEach(async () => {
    ;[deployer, user, user2, treasury] = await ethers.getSigners()
    collateralToken = await testERC20Fixture('prePO USDC Collateral', 'preUSD', 18)
    await collateralToken.mint(deployer.address, MOCK_COLLATERAL_SUPPLY)
    prePOMarketFactory = await prePOMarketFactoryFixture()
    await prePOMarketFactory.setCollateralValidity(collateralToken.address, true)
    defaultParams = {
      caller: deployer,
      factory: prePOMarketFactory,
      tokenNameSuffix: TEST_NAME_SUFFIX,
      tokenSymbolSuffix: TEST_SYMBOL_SUFFIX,
      longTokenSalt: formatBytes32String('LONG_SALT'),
      shortTokenSalt: formatBytes32String('SHORT_SALT'),
      governance: treasury.address,
      collateral: collateralToken.address,
      floorLongPayout: TEST_FLOOR_PAYOUT,
      ceilingLongPayout: TEST_CEILING_PAYOUT,
      floorValuation: TEST_FLOOR_VAL,
      ceilingValuation: TEST_CEILING_VAL,
      expiryTime: TEST_EXPIRY,
    }
  })

  describe('# initialize', () => {
    it('should be initialized with correct values', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())

      expect(await prePOMarket.getCollateral()).to.eq(collateralToken.address)
      expect(await longToken.owner()).to.eq(prePOMarket.address)
      expect(await shortToken.owner()).to.eq(prePOMarket.address)
      expect(await prePOMarket.getFloorLongPayout()).to.eq(TEST_FLOOR_PAYOUT)
      expect(await prePOMarket.getCeilingLongPayout()).to.eq(TEST_CEILING_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.eq(MAX_PAYOUT.add(1))
      expect(await prePOMarket.getFloorValuation()).to.eq(TEST_FLOOR_VAL)
      expect(await prePOMarket.getCeilingValuation()).to.eq(TEST_CEILING_VAL)
      expect(await prePOMarket.getRedemptionFee()).to.eq(0)
      expect(await prePOMarket.getExpiryTime()).to.eq(TEST_EXPIRY)
      expect(await prePOMarket.getMaxPayout()).to.eq(MAX_PAYOUT)
      expect(await prePOMarket.getFeeDenominator()).to.eq(FEE_DENOMINATOR)
      expect(await prePOMarket.getFeeLimit()).to.eq(MARKET_FEE_LIMIT)
    })

    it('should set owner to governance', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))

      expect(await prePOMarket.owner()).to.eq(treasury.address)
    })

    it('should not allow floor = ceiling', async () => {
      await expect(
        createMarket({
          ...defaultParams,
          ceilingLongPayout: TEST_FLOOR_PAYOUT,
        })
      ).revertedWith(revertReason('Ceiling must exceed floor'))
    })

    it('should not allow floor > ceiling', async () => {
      await expect(
        createMarket({
          ...defaultParams,
          floorLongPayout: TEST_CEILING_PAYOUT,
          ceilingLongPayout: TEST_FLOOR_PAYOUT,
        })
      ).revertedWith(revertReason('Ceiling must exceed floor'))
    })

    it('should not allow ceiling >  1', async () => {
      await expect(
        createMarket({
          ...defaultParams,
          ceilingLongPayout: MAX_PAYOUT.add(1),
        })
      ).revertedWith(revertReason('Ceiling cannot exceed 1'))
    })

    it('should not allow expiry before current time', async () => {
      const lastTimestamp = await getLastTimestamp()

      await expect(
        createMarket({
          ...defaultParams,
          expiryTime: lastTimestamp - 1,
        })
      ).revertedWith(revertReason('Invalid expiry'))
    })

    it('should not allow expiry at current time', async () => {
      const lastTimestamp = await getLastTimestamp()

      await expect(
        createMarket({
          ...defaultParams,
          expiryTime: lastTimestamp,
        })
      ).revertedWith(revertReason('Invalid expiry'))
    })

    it('should emit MarketCreated event', async () => {
      const createMarketResult = await createMarket(defaultParams)
      prePOMarket = await prePOMarketAttachFixture(createMarketResult)

      await expect(createMarketResult.tx)
        .to.emit(prePOMarket, 'MarketCreated')
        .withArgs(
          await prePOMarket.getLongToken(),
          await prePOMarket.getShortToken(),
          await prePOMarket.getFloorLongPayout(),
          await prePOMarket.getCeilingLongPayout(),
          TEST_FLOOR_VAL,
          TEST_CEILING_VAL,
          TEST_EXPIRY
        )
    })
  })

  describe('# setFinalLongPayout', () => {
    beforeEach(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
    })

    it('should only be usable by the owner', async () => {
      await expect(prePOMarket.connect(user).setFinalLongPayout(MAX_PAYOUT)).to.revertedWith(
        revertReason('Ownable: caller is not the owner')
      )
    })

    it('should not be settable beyond ceiling', async () => {
      await expect(
        prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.add(1))
      ).to.revertedWith(revertReason('Payout cannot exceed ceiling'))
    })

    it('should not be settable below floor', async () => {
      await expect(
        prePOMarket.connect(treasury).setFinalLongPayout(TEST_FLOOR_PAYOUT.sub(1))
      ).to.revertedWith(revertReason('Payout cannot be below floor'))
    })

    it('should be settable to value between payout and ceiling', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      expect(await prePOMarket.getFinalLongPayout()).to.eq(TEST_CEILING_PAYOUT.sub(1))
    })

    it('should correctly set the same value twice', async () => {
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      expect(await prePOMarket.getFinalLongPayout()).to.eq(TEST_CEILING_PAYOUT.sub(1))

      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))

      expect(await prePOMarket.getFinalLongPayout()).to.eq(TEST_CEILING_PAYOUT.sub(1))
    })

    it('should emit a FinalLongPayoutSet event', async () => {
      const tx = await prePOMarket.connect(treasury).setFinalLongPayout(TEST_CEILING_PAYOUT.sub(1))
      await expect(tx)
        .to.emit(prePOMarket, 'FinalLongPayoutSet')
        .withArgs(TEST_CEILING_PAYOUT.sub(1))
    })
  })

  describe('# setMintHook', () => {
    beforeEach(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
    })

    it('reverts if not owner', async () => {
      expect(await prePOMarket.owner()).to.not.eq(user.address)

      await expect(prePOMarket.connect(user).setMintHook(user.address)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await prePOMarket.getMintHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setMintHook(user.address)

      expect(await prePOMarket.getMintHook()).to.eq(user.address)
    })

    it('sets to zero address', async () => {
      await prePOMarket.connect(treasury).setMintHook(user.address)
      expect(await prePOMarket.getMintHook()).to.not.eq(ZERO_ADDRESS)

      await prePOMarket.connect(treasury).setMintHook(ZERO_ADDRESS)

      expect(await prePOMarket.getMintHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await prePOMarket.getMintHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setMintHook(user.address)

      expect(await prePOMarket.getMintHook()).to.eq(user.address)

      await prePOMarket.connect(treasury).setMintHook(user.address)

      expect(await prePOMarket.getMintHook()).to.eq(user.address)
    })

    it('emits MintHookChange', async () => {
      const tx = await prePOMarket.connect(treasury).setMintHook(user.address)

      await expect(tx).to.emit(prePOMarket, 'MintHookChange').withArgs(user.address)
    })
  })

  describe('# setRedeemHook', () => {
    beforeEach(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
    })

    it('reverts if not owner', async () => {
      expect(await prePOMarket.owner()).to.not.eq(user.address)

      await expect(prePOMarket.connect(user).setRedeemHook(user.address)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await prePOMarket.getRedeemHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setRedeemHook(user.address)

      expect(await prePOMarket.getRedeemHook()).to.eq(user.address)
    })

    it('sets to zero address', async () => {
      await prePOMarket.connect(treasury).setRedeemHook(user.address)
      expect(await prePOMarket.getRedeemHook()).to.not.eq(ZERO_ADDRESS)

      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)

      expect(await prePOMarket.getRedeemHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await prePOMarket.getRedeemHook()).to.not.eq(user.address)

      await prePOMarket.connect(treasury).setRedeemHook(user.address)

      expect(await prePOMarket.getRedeemHook()).to.eq(user.address)

      await prePOMarket.connect(treasury).setRedeemHook(user.address)

      expect(await prePOMarket.getRedeemHook()).to.eq(user.address)
    })

    it('emits RedeemHookChange', async () => {
      const tx = await prePOMarket.connect(treasury).setRedeemHook(user.address)

      await expect(tx).to.emit(prePOMarket, 'RedeemHookChange').withArgs(user.address)
    })
  })

  describe('# setRedemptionFee', () => {
    beforeEach(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
    })

    it('reverts if not owner', async () => {
      await expect(
        prePOMarket.connect(user).setRedemptionFee(MARKET_FEE_LIMIT - 1)
      ).to.revertedWith(revertReason('Ownable: caller is not the owner'))
    })

    it('reverts if > FEE_LIMIT', async () => {
      await expect(
        prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT + 1)
      ).to.revertedWith(revertReason('Exceeds fee limit'))
    })

    it('sets to FEE_LIMIT', async () => {
      expect(await prePOMarket.getRedemptionFee()).to.not.eq(MARKET_FEE_LIMIT)

      await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT)

      expect(await prePOMarket.getRedemptionFee()).to.eq(MARKET_FEE_LIMIT)
    })

    it('sets to < FEE_LIMIT', async () => {
      expect(await prePOMarket.getRedemptionFee()).to.not.eq(MARKET_FEE_LIMIT - 1)

      await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT - 1)

      expect(await prePOMarket.getRedemptionFee()).to.eq(MARKET_FEE_LIMIT - 1)
    })

    it('sets to zero', async () => {
      await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT)

      expect(await prePOMarket.getRedemptionFee()).to.not.eq(0)

      await prePOMarket.connect(treasury).setRedemptionFee(0)

      expect(await prePOMarket.getRedemptionFee()).to.eq(0)
    })

    it('emits RedemptionFeeChange', async () => {
      const tx = await prePOMarket.connect(treasury).setRedemptionFee(MARKET_FEE_LIMIT)

      await expect(tx).to.emit(prePOMarket, 'RedemptionFeeChange').withArgs(MARKET_FEE_LIMIT)
    })
  })

  describe('# mint', () => {
    let mintHook: FakeContract<Contract>
    beforeEach(async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
    })

    it('prevents minting if market ended', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(treasury).setFinalLongPayout(TEST_FINAL_LONG_PAYOUT)

      await expect(prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)).revertedWith(
        revertReason('Market ended')
      )
    })

    it('should not allow minting an amount exceeding owned collateral', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT.sub(1))
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT.sub(1))

      await expect(prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)).revertedWith(
        revertReason('Insufficient collateral')
      )
    })

    it('transfers collateral from sender', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(await collateralToken.balanceOf(prePOMarket.address)).to.eq(TEST_MINT_AMOUNT)
    })

    it('mints long and short tokens in equal amounts', async () => {
      const longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      const shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(await longToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT)
      expect(await shortToken.balanceOf(user.address)).to.eq(TEST_MINT_AMOUNT)
    })

    it('calls hook with correct parameters', async () => {
      mintHook = await fakeMintHookFixture()
      await prePOMarket.connect(treasury).setMintHook(mintHook.address)
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(mintHook.hook).to.be.calledWith(user.address, TEST_MINT_AMOUNT, TEST_MINT_AMOUNT)
    })

    it('ignores hook if not set', async () => {
      // reset smock hook or else smock history will be preserved from previous test
      mintHook = await fakeMintHookFixture()
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(treasury).setMintHook(ZERO_ADDRESS)

      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      expect(mintHook.hook).to.not.be.called
    })

    it('reverts if hook reverts', async () => {
      mintHook = await fakeMintHookFixture()
      await prePOMarket.connect(treasury).setMintHook(mintHook.address)
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      mintHook.hook.reverts()

      await expect(prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)).to.be.reverted
    })

    it('emits Mint', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)

      const mintFilter = {
        address: prePOMarket.address,
        topics: [
          ethers.utils.id('Mint(address,uint256)'),
          ethers.utils.hexZeroPad(user.address, 32),
        ],
      }
      const mintEvents = await prePOMarket.queryFilter(mintFilter)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mintEvent = mintEvents[0].args as any

      expect(await mintEvent.minter).to.eq(user.address)
      expect(await mintEvent.amount).to.eq(TEST_MINT_AMOUNT)
    })

    it('returns long short tokens minted', async () => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)

      expect(await prePOMarket.connect(user).callStatic.mint(TEST_MINT_AMOUNT)).to.eq(
        TEST_MINT_AMOUNT
      )
    })
  })

  describe('# redeem', () => {
    let longToken: LongShortToken
    let shortToken: LongShortToken
    let redeemHook: FakeContract<Contract>

    const mintTestPosition = async (): Promise<BigNumber> => {
      await collateralToken.connect(deployer).transfer(user.address, TEST_MINT_AMOUNT)
      await collateralToken.connect(user).approve(prePOMarket.address, TEST_MINT_AMOUNT)
      await prePOMarket.connect(user).mint(TEST_MINT_AMOUNT)
      return TEST_MINT_AMOUNT
    }

    // TODO: need to implement a way to remove the need for approval calls, perhaps using permit signatures?
    const approveTokensForRedemption = async (
      owner: SignerWithAddress,
      amount: BigNumber
    ): Promise<void> => {
      longToken = await LongShortTokenAttachFixture(await prePOMarket.getLongToken())
      shortToken = await LongShortTokenAttachFixture(await prePOMarket.getShortToken())
      await longToken.connect(owner).approve(prePOMarket.address, amount)
      await shortToken.connect(owner).approve(prePOMarket.address, amount)
    }

    const setupMarket = async (): Promise<BigNumber> => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      redeemHook = await fakeMintHookFixture()
      const amountMinted = await mintTestPosition()
      await approveTokensForRedemption(user, amountMinted)
      await prePOMarket.connect(treasury).setRedemptionFee(TEST_REDEMPTION_FEE)
      await prePOMarket.connect(treasury).setRedeemHook(redeemHook.address)
      return amountMinted
    }

    const setupMarketToEnd = async (finalLongPayout: BigNumber): Promise<BigNumber> => {
      const amountMinted = await setupMarket()
      await prePOMarket.connect(treasury).setFinalLongPayout(finalLongPayout)
      return amountMinted
    }

    const calculateTotalOwed = async (
      longToRedeem: BigNumber,
      shortToRedeem: BigNumber,
      finalPayoutSet: boolean
    ): Promise<BigNumber> => {
      let totalOwed: BigNumber
      if (finalPayoutSet) {
        totalOwed = longToRedeem
      } else {
        const owedForLongs = longToRedeem
          .mul(await prePOMarket.getFinalLongPayout())
          .div(MAX_PAYOUT)
        const owedForShort = shortToRedeem
          .mul(MAX_PAYOUT.sub(await prePOMarket.getFinalLongPayout()))
          .div(MAX_PAYOUT)
        totalOwed = owedForLongs.add(owedForShort)
      }
      return totalOwed
    }

    it('reverts if amounts = 0, fee = 0%, and before market end', async () => {
      await setupMarket()
      await prePOMarket.connect(treasury).setRedemptionFee(0)

      await expect(prePOMarket.connect(user).redeem(0, 0)).to.be.revertedWith('amount = 0')
    })

    it('reverts if amounts = 0, fee = 0%, and after market end', async () => {
      await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      await prePOMarket.connect(treasury).setRedemptionFee(0)

      await expect(prePOMarket.connect(user).redeem(0, 0)).to.be.revertedWith('amount = 0')
    })

    it('reverts if amounts = 0, fee > 0%, and before market end', async () => {
      await setupMarket()
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)

      await expect(prePOMarket.connect(user).redeem(0, 0)).to.be.revertedWith('fee = 0')
    })

    it('reverts if amounts = 0, fee > 0%, and after market end', async () => {
      await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)

      await expect(prePOMarket.connect(user).redeem(0, 0)).to.be.revertedWith('fee = 0')
    })

    it('reverts if hook reverts', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = amountMinted
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      redeemHook.hook.reverts()

      await expect(prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)).reverted
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming equal parts', async () => {
      await setupMarket()
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)
      /**
       * Given a test fee of 20 (0.002%), smallest redemption that would result in a
       * fee(of 1) would be 50000 wei, so for fee = 0, redeem 49999.
       */
      const longToRedeem = BigNumber.from(49999)
      const shortToRedeem = longToRedeem
      expect(await longToken.balanceOf(user.address)).to.be.gte(longToRedeem)
      expect(await shortToken.balanceOf(user.address)).to.be.gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      expect(calculateFee(totalOwed, await prePOMarket.getRedemptionFee())).to.eq(0)

      await expect(
        prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)
      ).to.be.revertedWith('fee = 0')
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming more long', async () => {
      await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const shortToRedeem = BigNumber.from(2)
      const longToRedeem = BigNumber.from(99998).sub(shortToRedeem)
      expect(await longToken.balanceOf(user.address)).to.be.gte(longToRedeem)
      expect(await shortToken.balanceOf(user.address)).to.be.gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      expect(calculateFee(totalOwed, await prePOMarket.getRedemptionFee())).to.eq(0)

      await expect(
        prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)
      ).to.be.revertedWith('fee = 0')
    })

    it('reverts if amounts > 0, fee amount = 0, fee > 0%, and redeeming more short', async () => {
      await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      expect(await prePOMarket.getRedemptionFee()).to.be.gt(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const longToRedeem = BigNumber.from(2)
      const shortToRedeem = BigNumber.from(99998).sub(longToRedeem)
      expect(await longToken.balanceOf(user.address)).to.be.gte(longToRedeem)
      expect(await shortToken.balanceOf(user.address)).to.be.gte(shortToRedeem)
      // expect fee to be zero
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      expect(calculateFee(totalOwed, await prePOMarket.getRedemptionFee())).to.eq(0)

      await expect(
        prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)
      ).to.be.revertedWith('fee = 0')
    })

    it('should not allow long token redemption exceeding long token balance', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const amountMinted = await mintTestPosition()

      await expect(
        prePOMarket.connect(user).redeem(amountMinted.add(1), amountMinted)
      ).revertedWith(revertReason('Insufficient long tokens'))
    })

    it('should not allow short token redemption exceeding short token balance', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const amountMinted = await mintTestPosition()

      await expect(
        prePOMarket.connect(user).redeem(amountMinted, amountMinted.add(1))
      ).revertedWith(revertReason('Insufficient short tokens'))
    })

    it('should only allow token redemption in equal parts before expiry', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const amountMinted = await mintTestPosition()

      await expect(
        prePOMarket.connect(user).redeem(amountMinted, amountMinted.sub(1))
      ).revertedWith(revertReason('Long and Short must be equal'))
    })

    it('should correctly settle equal non-zero redemption amounts before market end', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = amountMinted
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await longToken.balanceOf(user.address)).to.eq(amountMinted.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(amountMinted.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('should correctly settle non-equal non-zero redemption amounts after market end', async () => {
      const amountMinted = await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = amountMinted
      const shortToRedeem = amountMinted.sub(1)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await longToken.balanceOf(user.address)).to.eq(amountMinted.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(amountMinted.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('should correctly settle redemption done with only long tokens after market end', async () => {
      const amountMinted = await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = amountMinted
      const shortToRedeem = ethers.utils.parseEther('0')
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await longToken.balanceOf(user.address)).to.eq(amountMinted.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(amountMinted.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('should correctly settle redemption done with only short tokens after market end', async () => {
      const amountMinted = await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      const longToRedeem = ethers.utils.parseEther('0')
      const shortToRedeem = amountMinted
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await longToken.balanceOf(user.address)).to.eq(amountMinted.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(amountMinted.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming equal parts', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedemptionFee(0)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await longToken.balanceOf(user.address)).to.eq(amountMinted.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(amountMinted.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming more long', async () => {
      await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      await prePOMarket.connect(treasury).setRedemptionFee(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const shortToRedeem = BigNumber.from(2)
      const longToRedeem = BigNumber.from(99998).sub(shortToRedeem)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const longBalanceBefore = await longToken.balanceOf(user.address)
      const shortBalanceBefore = await shortToken.balanceOf(user.address)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await longToken.balanceOf(user.address)).to.eq(longBalanceBefore.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(shortBalanceBefore.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('allows amounts > 0 if fee = 0% and redeeming more short', async () => {
      await setupMarketToEnd(TEST_FINAL_LONG_PAYOUT)
      expect(await prePOMarket.getFinalLongPayout()).to.be.lte(MAX_PAYOUT)
      await prePOMarket.connect(treasury).setRedemptionFee(0)
      /**
       * The test final payout is 0.5, so to generate a total collateral returned of 49999,
       * the long and short to redeem must add up to 49999 * 2 = 99998
       */
      const longToRedeem = BigNumber.from(2)
      const shortToRedeem = BigNumber.from(99998).sub(longToRedeem)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const longBalanceBefore = await longToken.balanceOf(user.address)
      const shortBalanceBefore = await shortToken.balanceOf(user.address)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await longToken.balanceOf(user.address)).to.eq(longBalanceBefore.sub(longToRedeem))
      expect(await shortToken.balanceOf(user.address)).to.eq(shortBalanceBefore.sub(shortToRedeem))
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('calls hook with correct parameters', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(redeemHook.hook).to.be.calledWith(user.address, totalOwed, totalOwed.sub(redeemFee))
    })

    it('ignores hook if not set', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(redeemHook.hook).to.not.be.called
    })

    it('approves fee for hook to use', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
    })

    it('sets approval back to 0', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
      expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, 0)
      expect(await collateralToken.allowance(prePOMarket.address, redeemHook.address)).to.eq(0)
    })

    it("doesn't approve fee if hook not set", async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(tx).to.not.emit(collateralToken, 'Approval')
      expect(await collateralToken.allowance(prePOMarket.address, redeemHook.address)).to.eq(0)
    })

    it('sends full collateral amount if hook not set', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      await prePOMarket.connect(treasury).setRedeemHook(ZERO_ADDRESS)
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    // TODO ADD 'sends correct collateral amount if hook takes partial fee'
    // TODO ADD 'sends correct collateral amount if hook takes full fee'

    it('sends full collateral amount if hook takes no fee', async () => {
      const amountMinted = await setupMarket()
      const longToRedeem = amountMinted
      const shortToRedeem = longToRedeem
      const totalOwed = await calculateTotalOwed(longToRedeem, shortToRedeem, false)
      expect(totalOwed).to.be.gt(0)
      const redeemFee = calculateFee(totalOwed, await prePOMarket.getRedemptionFee())
      expect(redeemFee).to.be.gt(0)

      const tx = await prePOMarket.connect(user).redeem(longToRedeem, shortToRedeem)

      expect(tx)
        .to.emit(collateralToken, 'Approval')
        .withArgs(prePOMarket.address, redeemHook.address, redeemFee)
      expect(await collateralToken.balanceOf(user.address)).to.eq(totalOwed)
    })

    it('emits Redemption indexed by redeemer', async () => {
      prePOMarket = await prePOMarketAttachFixture(await createMarket(defaultParams))
      const amountMinted = await mintTestPosition()
      await approveTokensForRedemption(user, amountMinted)
      const redeemFee = calculateFee(amountMinted, await prePOMarket.getRedemptionFee())

      await prePOMarket.connect(user).redeem(amountMinted, amountMinted)

      const filter = {
        address: prePOMarket.address,
        topics: [
          ethers.utils.id('Redemption(address,uint256,uint256)'),
          ethers.utils.hexZeroPad(user.address, 32),
        ],
      }
      const events = await prePOMarket.queryFilter(filter)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = events[0].args as any
      expect(await event.redeemer).to.eq(user.address)
      expect(await event.amountAfterFee).to.eq(amountMinted.sub(redeemFee))
      expect(await event.fee).to.eq(redeemFee)
    })
  })
})

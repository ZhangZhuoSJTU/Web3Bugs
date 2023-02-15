import {
  utils,
  providers,
  constants,
  Signer,
  BigNumber,
  BigNumberish
} from "ethers";

import { encodeSqrtRatioX96 } from "@uniswap/v3-sdk";
import JSBI from "jsbi";

import { ether, preciseMul, preciseDiv } from "../common";
import { Account } from "../test/types";

import {
  PerpV2AccountBalance,
  PerpV2BaseToken,
  PerpV2ClearingHouseConfig,
  PerpV2Exchange,
  PerpV2InsuranceFund,
  PerpV2Vault,
  PerpV2OrderBook,
  PerpV2MarketRegistry,
  PerpV2ClearingHouse,
  PerpV2QuoteToken,
  PerpV2VirtualToken,
  PerpV2Quoter,
} from "../contracts/perpV2";

import {
  UniswapV3Factory,
  UniswapV3Pool
} from "../contracts/uniswapV3";

import {
  StandardTokenMock,
  ChainlinkAggregatorMock
} from "../contracts";

import DeployHelper from "../deploys";
import { Address } from "../types";

import {
  ZERO,
  ZERO_BYTES,
  MAX_UINT_256
} from "../constants";

export interface TokensFixture {
  token0: PerpV2BaseToken;
  token1: PerpV2QuoteToken;
  mockAggregator0: ChainlinkAggregatorMock;
  mockAggregator1: ChainlinkAggregatorMock;
}

export interface PoolFixture {
  factory: UniswapV3Factory;
  pool: UniswapV3Pool;
  baseToken: PerpV2BaseToken;
  quoteToken: PerpV2QuoteToken;
}

export interface BaseTokenFixture {
  baseToken: PerpV2BaseToken;
  mockAggregator: ChainlinkAggregatorMock;
}

export interface PositionInfo {
  baseToken: Address;
  baseBalance: BigNumber;
  quoteBalance: BigNumber;
}

const ONE_MILLION = "1000000";

export class PerpV2Fixture {
  private _deployer: DeployHelper;
  private _ownerAddress: Address;
  private _ownerSigner: Signer;
  private _feeTier: number = 10000; // From perp fixtures: 1%
  private _usdcDecimals: number; // From perp fixtures
  private _priceFeeds: any = {};
  private _pools: any = {};

  public maker: Account;
  public otherTrader: Account;
  public usdc: StandardTokenMock;
  public clearingHouse: PerpV2ClearingHouse;
  public orderBook: PerpV2OrderBook;
  public accountBalance: PerpV2AccountBalance;
  public marketRegistry: PerpV2MarketRegistry;
  public clearingHouseConfig: PerpV2ClearingHouseConfig;
  public quoter: PerpV2Quoter;

  public exchange: PerpV2Exchange;
  public vault: PerpV2Vault;
  public insuranceFund: PerpV2InsuranceFund;
  public uniV3Factory: UniswapV3Factory;

  public vETHPool: UniswapV3Pool;
  public vBTCPool: UniswapV3Pool;
  public vETH: PerpV2BaseToken;
  public vBTC: PerpV2BaseToken;
  public ethPriceFeed: ChainlinkAggregatorMock;
  public btcPriceFeed: ChainlinkAggregatorMock;
  public vQuote: PerpV2QuoteToken;
  public feeTierPercent: BigNumber = ether(.01); // 1%


  constructor(provider: providers.Web3Provider | providers.JsonRpcProvider, ownerAddress: Address) {
    this._ownerAddress = ownerAddress;
    this._ownerSigner = provider.getSigner(ownerAddress);
    this._deployer = new DeployHelper(this._ownerSigner);
  }

  public async initialize(_maker: Account, _otherTrader: Account): Promise<void> {
    this.maker = _maker;
    this.otherTrader = _otherTrader;

    this.usdc = await this._deployer.mocks.deployTokenMock(this._ownerAddress, ether("100000000000000"), 6);
    this._usdcDecimals = 6;

    // deploy vETH pool
    const {
      token0: vETH,
      token1: vQuote,
      mockAggregator0: ethPriceFeed,
    } = await this._tokensFixture();

    // deploy vBTC pool (18 decimals)
    const {
      baseToken: vBTC,
      mockAggregator: btcPriceFeed
    } = await this._token0Fixture(vQuote.address);

    // we assume (base, quote) == (token0, token1)
    this.vETH = vETH;
    this.vBTC = vBTC;
    this.vQuote = vQuote;
    this.ethPriceFeed = ethPriceFeed;
    this.btcPriceFeed = btcPriceFeed;

    this._priceFeeds[this.vETH.address] = this.ethPriceFeed;
    this._priceFeeds[this.vBTC.address] = this.btcPriceFeed;

    // deploy UniV3 factory
    this.uniV3Factory = await this._deployer.external.deployUniswapV3Factory();

    this.clearingHouseConfig = await this._deployer.external.deployPerpV2ClearingHouseConfig();
    await this.clearingHouseConfig.initialize();

    // prepare uniswap factories
    await this.uniV3Factory.createPool(
      this.vETH.address,
      this.vQuote.address,
      this._feeTier
    );

    await this.uniV3Factory.createPool(
      this.vBTC.address,
      this.vQuote.address,
      this._feeTier
    );

    this.marketRegistry = await this._deployer.external.deployPerpV2MarketRegistry();
    await this.marketRegistry.initialize(this.uniV3Factory.address, this.vQuote.address);

    this.orderBook = await this._deployer.external.deployPerpV2OrderBook();
    await this.orderBook.initialize(this.marketRegistry.address);

    this.insuranceFund = await this._deployer.external.deployPerpV2InsuranceFund();
    await this.insuranceFund.initialize(this.usdc.address);

    this.accountBalance = await this._deployer.external.deployPerpV2AccountBalance();
    this.exchange = await this._deployer.external.deployPerpV2Exchange();

    // deploy exchange
    await this.exchange.initialize(
      this.marketRegistry.address,
      this.orderBook.address,
      this.clearingHouseConfig.address
    );

    this.exchange.setAccountBalance(this.accountBalance.address);
    await this.orderBook.setExchange(this.exchange.address);

    await this.accountBalance.initialize(
      this.clearingHouseConfig.address,
      this.orderBook.address
    );

    this.vault = await this._deployer.external.deployPerpV2Vault();

    await this.vault.initialize(
      this.insuranceFund.address,
      this.clearingHouseConfig.address,
      this.accountBalance.address,
      this.exchange.address,
    );

    await this.insuranceFund.setBorrower(this.vault.address);
    await this.accountBalance.setVault(this.vault.address);

    // get pool instance
    const poolAddrA = await this.uniV3Factory.getPool(
      this.vETH.address,
      this.vQuote.address,
      this._feeTier
    );

    const poolAddrB = await this.uniV3Factory.getPool(
      this.vBTC.address,
      this.vQuote.address,
      this._feeTier
    );

    this.vETHPool = await this._deployer.external.getUniswapV3PoolInstance(poolAddrA);
    this.vBTCPool = await this._deployer.external.getUniswapV3PoolInstance(poolAddrB);

    this._pools[vETH.address] = this.vETHPool;
    this._pools[vBTC.address] = this.vBTCPool;

    await this.vETH.addWhitelist(poolAddrA);
    await this.vBTC.addWhitelist(poolAddrB);

    await this.vQuote.addWhitelist(poolAddrA);
    await this.vQuote.addWhitelist(poolAddrB);

    // deploy clearingHouse
    this.clearingHouse = await this._deployer.external.deployPerpV2ClearingHouse();

    await this.clearingHouse.initialize(
      this.clearingHouseConfig.address,
      this.vault.address,
      this.vQuote.address,
      this.uniV3Factory.address,
      this.exchange.address,
      this.accountBalance.address,
      this.insuranceFund.address
    );

    await this.clearingHouseConfig.setSettlementTokenBalanceCap(MAX_UINT_256);

    this.quoter = await this._deployer.external.deployPerpV2Quoter(this.marketRegistry.address);

    await this.vQuote.mintMaximumTo(this.clearingHouse.address);
    await this.vETH.mintMaximumTo(this.clearingHouse.address);
    await this.vBTC.mintMaximumTo(this.clearingHouse.address);

    await this.vQuote.addWhitelist(this.clearingHouse.address);
    await this.vETH.addWhitelist(this.clearingHouse.address);
    await this.vBTC.addWhitelist(this.clearingHouse.address);

    await this.marketRegistry.setClearingHouse(this.clearingHouse.address);
    await this.orderBook.setClearingHouse(this.clearingHouse.address);
    await this.exchange.setClearingHouse(this.clearingHouse.address);
    await this.accountBalance.setClearingHouse(this.clearingHouse.address);
    await this.vault.setClearingHouse(this.clearingHouse.address);

    // prepare collateral for maker
    const makerCollateralAmount = utils.parseUnits(ONE_MILLION, this._usdcDecimals);
    await this.usdc.mint(this.maker.address, makerCollateralAmount);
    await this.deposit(this.maker, BigNumber.from(ONE_MILLION), this.usdc);

    // prepare collateral for maker
    const otherCollateralAmount = utils.parseUnits(ONE_MILLION, this._usdcDecimals);
    await this.usdc.mint(this.otherTrader.address, otherCollateralAmount);
    await this.deposit(this.otherTrader, BigNumber.from(ONE_MILLION), this.usdc);
  }

  async deposit(sender: Account, amount: BigNumber, token: StandardTokenMock): Promise<void> {
    const decimals = await token.decimals();
    const parsedAmount = utils.parseUnits(amount.toString(), decimals);
    await token.connect(sender.wallet).approve(this.vault.address, parsedAmount);
    await this.vault.connect(sender.wallet).deposit(token.address, parsedAmount);
  }

  public async initializePoolWithLiquidityWide(
    baseToken: PerpV2BaseToken,
    baseTokenAmount: BigNumberish,
    quoteTokenAmount: BigNumberish
  ): Promise<void> {
    const pool = this._pools[baseToken.address];

    await pool.initialize(this._encodePriceSqrt(quoteTokenAmount, baseTokenAmount));
    await pool.increaseObservationCardinalityNext((2 ^ 16) - 1);

    const tickSpacing = await pool.tickSpacing();
    const lowerTick = this._getMinTick(tickSpacing);
    const upperTick = this._getMaxTick(tickSpacing);

    await this.marketRegistry.addPool(baseToken.address, this._feeTier);
    await this.marketRegistry.setFeeRatio(baseToken.address, this._feeTier);

    // maker add liquidity at ratio
    await this.clearingHouse.connect(this.maker.wallet).addLiquidity({
      baseToken: baseToken.address,
      base: baseTokenAmount,
      quote: quoteTokenAmount,
      lowerTick,
      upperTick,
      minBase: 0,
      minQuote: 0,
      useTakerBalance: false,
      deadline: constants.MaxUint256,
    });
  }

  public async initializePoolWithLiquidityWithinTicks(
    baseToken: PerpV2BaseToken,
    baseTokenAmount: BigNumberish,
    quoteTokenAmount: BigNumberish,
    lowerTick: number,
    upperTick: number
  ): Promise<void> {
    const pool = this._pools[baseToken.address];

    await pool.initialize(this._encodePriceSqrt(quoteTokenAmount, baseTokenAmount));
    await pool.increaseObservationCardinalityNext((2 ^ 16) - 1);

    await this.marketRegistry.addPool(baseToken.address, this._feeTier);
    await this.marketRegistry.setFeeRatio(baseToken.address, this._feeTier);

    // maker add liquidity at ratio
    await this.clearingHouse.connect(this.maker.wallet).addLiquidity({
      baseToken: baseToken.address,
      base: baseTokenAmount,
      quote: quoteTokenAmount,
      lowerTick,
      upperTick,
      minBase: 0,
      minQuote: 0,
      useTakerBalance: false,
      deadline: constants.MaxUint256,
    });
  }

  public async setBaseTokenOraclePrice(baseToken: PerpV2BaseToken, price: BigNumber): Promise<void> {
    await this._priceFeeds[baseToken.address].setRoundData(
      0,
      price,
      0,
      0,
      0
    );
  }

  public async getSpotPrice(_baseToken: Address): Promise<BigNumber> {
    const pool = this._pools[_baseToken];

    const sqrtPriceX96 = (await pool.slot0()).sqrtPriceX96;
    return this.getPriceFromSqrtPriceX96(sqrtPriceX96);
  }

  public getPriceFromSqrtPriceX96(sqrtPriceX96: BigNumber): BigNumber {
    const priceX86 = JSBI.BigInt(sqrtPriceX96.toString());
    const squaredPrice = JSBI.multiply(priceX86, priceX86);
    const decimalsRatio = 1e18;
    const denominator = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(192));
    const scaledPrice = JSBI.multiply(squaredPrice, JSBI.BigInt(decimalsRatio));
    return BigNumber.from(JSBI.divide(scaledPrice, denominator).toString());
  }

  public async getSwapQuote(baseToken: Address, baseQuantity: BigNumber, isBuy: boolean):
  Promise<{
    deltaBase: BigNumber;
    deltaQuote: BigNumber;
  }> {
    const {
      base: deltaBase,
      quote: deltaQuote,
    } = await this.clearingHouse
      .connect(this.otherTrader.wallet)
      .callStatic
      .openPosition({
        baseToken: baseToken,
        isBaseToQuote: !isBuy,
        isExactInput: !isBuy,
        amount: baseQuantity,
        oppositeAmountBound: ZERO,
        deadline:  MAX_UINT_256,
        sqrtPriceLimitX96: ZERO,
        referralCode: ZERO_BYTES
      });

    return { deltaBase, deltaQuote };
  }

  public async getCurrentLeverage(
    _setToken: Address,
    _positionInfo: PositionInfo,
    _collateralBalance: BigNumber
  ): Promise<BigNumber> {
    const price = await this.getSpotPrice(_positionInfo.baseToken);

    const basePositionAbsoluteValue = preciseMul(_positionInfo.baseBalance, price).abs();
    const basePositionNetValue = preciseMul(_positionInfo.baseBalance, price);


    return preciseDiv(
      basePositionAbsoluteValue,

      basePositionNetValue
        .add(_positionInfo.quoteBalance)
        .add(_collateralBalance)
    );
  }

  public async getVTokenInstance(token: Address): Promise<PerpV2BaseToken> {
    return await this._deployer.external.getVToken(token);
  }

  // UniV3 AddLiquidity helpers
  private _getMinTick(tickSpacing: number) {
    return Math.ceil(-887272 / tickSpacing) * tickSpacing;
  }

  private _getMaxTick(tickSpacing: number) {
    return Math.floor(887272 / tickSpacing) * tickSpacing;
  }

  private _encodePriceSqrt(token1Amount: BigNumberish, token0Amount: BigNumberish): BigNumber {
    return BigNumber.from(
      encodeSqrtRatioX96(token1Amount.toString(), token0Amount.toString()).toString()
    );
  }

  // Base & Quote token helpers
  async _createQuoteTokenFixture(name: string, symbol: string): Promise<PerpV2QuoteToken> {
    const quoteToken = await this._deployer.external.deployPerpV2QuoteToken();
    await quoteToken.initialize(name, symbol);
    return quoteToken;
  }

  async _createBaseTokenFixture(name: string, symbol: string): Promise<BaseTokenFixture> {
    const mockAggregator = await this._deployer.mocks.deployChainlinkAggregatorMock(6);

    const chainlinkPriceFeed = await this._deployer.external.deployPerpV2ChainlinkPriceFeed();
    await chainlinkPriceFeed.initialize(mockAggregator.address);

    const baseToken = await this._deployer.external.deployPerpV2BaseToken();
    await baseToken.initialize(name, symbol, chainlinkPriceFeed.address);

    return { baseToken, mockAggregator };
  }

  async _tokensFixture(): Promise<TokensFixture> {
    const {
      baseToken: randomToken0,
      mockAggregator: randomMockAggregator0,
    } = await this._createBaseTokenFixture(
      "RandomTestToken0",
      "randomToken0",
    );

    const {
      baseToken: randomToken1,
      mockAggregator: randomMockAggregator1,
    } = await this._createBaseTokenFixture(
      "RandomTestToken1",
      "randomToken1",
    );

    let token0: PerpV2BaseToken;
    let token1: PerpV2QuoteToken;
    let mockAggregator0: ChainlinkAggregatorMock;
    let mockAggregator1: ChainlinkAggregatorMock;

    if (this._isAscendingTokenOrder(randomToken0.address, randomToken1.address)) {
      token0 = randomToken0;
      mockAggregator0 = randomMockAggregator0;
      token1 = randomToken1 as PerpV2VirtualToken as PerpV2QuoteToken;
      mockAggregator1 = randomMockAggregator1;
    } else {
      token0 = randomToken1;
      mockAggregator0 = randomMockAggregator1;
      token1 = randomToken0 as PerpV2VirtualToken as PerpV2QuoteToken;
      mockAggregator1 = randomMockAggregator0;
    }
    return {
      token0,
      mockAggregator0,
      token1,
      mockAggregator1,
    };
  }

  private _isAscendingTokenOrder(addr0: string, addr1: string): boolean {
    return addr0.toLowerCase() < addr1.toLowerCase();
  }

  async _token0Fixture(token1Addr: string): Promise<BaseTokenFixture> {
    let token0Fixture: BaseTokenFixture | undefined;

    while (!token0Fixture || !this._isAscendingTokenOrder(token0Fixture.baseToken.address, token1Addr)) {
      token0Fixture = await this._createBaseTokenFixture("RandomTestToken0", "randomToken0");
    }
    return token0Fixture;
  }
}

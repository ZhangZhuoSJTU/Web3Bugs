import { expect } from "chai";
import { BigNumber, BytesLike, Contract, Transaction } from "ethers";
import { NumberOrString, fromWei, toWei, parseDecimal, formatDecimal } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { PoolShare, ShareKind } from "./PoolShare";
import { TempusController } from "./TempusController";

export enum PoolType {
  Aave = "Aave",
  Lido = "Lido",
  Compound = "Compound",
}

export interface TempusSharesNames {
  principalName: string;
  principalSymbol: string;
  yieldName: string;
  yieldSymbol: string;
}

export interface TempusFeesConfig {
  depositPercent: NumberOrString;
  earlyRedeemPercent: NumberOrString;
  matureRedeemPercent: NumberOrString;
}

export function generateTempusSharesNames(ybtName:string, ybtSymbol:string, maturityTime:number): TempusSharesNames {
  const date:Date = new Date(maturityTime * 1000);
  
  const year:number = date.getFullYear();
  const month:number = date.getMonth();
  const day:number = date.getDate();

  const nameSuffix:string = "-" + day + "-" + month + "-" + year;

  return {
    principalName:   "TPS-" + ybtName   + nameSuffix,
    principalSymbol: "TPS-" + ybtSymbol + nameSuffix,
    yieldName:       "TYS-" + ybtName   + nameSuffix,
    yieldSymbol:     "TYS-" + ybtSymbol + nameSuffix
  };
}

/**
 * Wrapper around TempusPool
 */
export class TempusPool extends ContractBase {
  controller:TempusController;
  type:PoolType;
  asset:ERC20; // asset token or in case of Lido, mocked asset
  yieldBearing:ERC20; // actual yield bearing token such as AToken or CToken
  principalShare:PoolShare;
  yieldShare:PoolShare;
  exchangeRatePrec:number;

  constructor(
    type:PoolType,
    pool:Contract,
    controller:TempusController,
    asset:ERC20,
    yieldBearing:ERC20,
    principalShare:PoolShare,
    yieldShare:PoolShare,
    exchangeRatePrecision:number
  ) {
    super(type+"TempusPool", asset.decimals, pool);
    this.controller = controller;
    this.type = type;
    this.asset = asset;
    this.yieldBearing = yieldBearing;
    this.principalShare = principalShare;
    this.yieldShare = yieldShare;
    this.exchangeRatePrec = exchangeRatePrecision;
  }

  /**
   * Deploys AaveTempusPool
   * @param yieldToken The yield bearing token, such as aave.earn (AToken)
   * @param controller The Tempus Controller address to bind to the TempusPool
   * @param maturityTime Maturity time of the pool
   * @param estimatedYield Initial estimated APR
   * @param tempusShareNames Symbol names for TPS+TYS
   */
  static async deployAave(
    asset:ERC20,
    yieldToken:ERC20,
    controller:TempusController,
    maturityTime:number,
    estimatedYield:number,
    tempusShareNames:TempusSharesNames
  ): Promise<TempusPool> {
    return TempusPool.deploy(
      PoolType.Aave, controller, asset, yieldToken, maturityTime, estimatedYield, tempusShareNames
    );
  }

  /**
   * Deploys CompoundTempusPool
   * @param yieldToken The yield bearing token, such as cDai
   * @param controller The Tempus Controller address to bind to the TempusPool
   * @param maturityTime Maturity time of the pool
   * @param estimatedYield Initial estimated APR
   * @param tempusShareNames Symbol names for TPS+TYS
   */
  static async deployCompound(
    asset:ERC20,
    yieldToken:ERC20,
    controller:TempusController,
    maturityTime:number,
    estimatedYield:number,
    tempusShareNames:TempusSharesNames
  ): Promise<TempusPool> {
    return TempusPool.deploy(
      PoolType.Compound, controller, asset, yieldToken, maturityTime, estimatedYield, tempusShareNames
    );
  }

  /**
   * Deploys LidoTempusPool
   * @param yieldToken The yield bearing token, such as stETH
   * @param controller The Tempus Controller address to bind to the TempusPool
   * @param maturityTime Maturity time of the pool
   * @param estimatedYield Initial estimated APR
   * @param tempusShareNames Symbol names for TPS+TYS
   */
  static async deployLido(
    asset:ERC20,
    yieldToken:ERC20,
    controller:TempusController,
    maturityTime:number,
    estimatedYield:number,
    tempusShareNames:TempusSharesNames
  ): Promise<TempusPool> {
    return TempusPool.deploy(
      PoolType.Lido, controller, asset, yieldToken, maturityTime, estimatedYield, tempusShareNames
    );
  }

  static async deploy(
    type:PoolType,
    controller:TempusController,
    asset:ERC20,
    yieldToken:ERC20,
    maturityTime:number,
    estimatedYield:number,
    shareNames:TempusSharesNames
  ): Promise<TempusPool> {
    let exchangeRatePrec:number;
    let pool:Contract = null;

    if (type === PoolType.Aave) {
      exchangeRatePrec = 18; // AaveTempusPool converts 1e27 LiquidityIndex to 1e18 interestRate
      pool = await ContractBase.deployContract(
        type + "TempusPool",
        yieldToken.address,
        controller.address,
        maturityTime,
        parseDecimal(estimatedYield, exchangeRatePrec),
        shareNames.principalName,
        shareNames.principalSymbol,
        shareNames.yieldName,
        shareNames.yieldSymbol,
        /*maxFeeSetup:*/{
          depositPercent:      yieldToken.toBigNum(0.5), // fees are stored in YBT
          earlyRedeemPercent:  yieldToken.toBigNum(1.0),
          matureRedeemPercent: yieldToken.toBigNum(0.5)
        },
        "0x00000" /* hardcoded referral code */
      );
    } else if (type === PoolType.Lido) {
      exchangeRatePrec = 18; // Lido is always 1e18 thanks to ETH
      pool = await ContractBase.deployContract(
        type + "TempusPool",
        yieldToken.address,
        controller.address,
        maturityTime,
        parseDecimal(estimatedYield, exchangeRatePrec),
        shareNames.principalName,
        shareNames.principalSymbol,
        shareNames.yieldName,
        shareNames.yieldSymbol,
        /*maxFeeSetup:*/{
          depositPercent:      yieldToken.toBigNum(0.5), // fees are stored in YBT
          earlyRedeemPercent:  yieldToken.toBigNum(1.0),
          matureRedeemPercent: yieldToken.toBigNum(0.5)
        },
        "0x0000000000000000000000000000000000000000" /* hardcoded referrer */
      );
    } else if (type === PoolType.Compound) {
      exchangeRatePrec = (10 + asset.decimals); // exchange rate precision = 18 - 8 + Underlying Token Decimals
      pool = await ContractBase.deployContract(
        type + "TempusPool",
        yieldToken.address,
        controller.address,
        maturityTime,
        parseDecimal(1.0, exchangeRatePrec),
        parseDecimal(estimatedYield, exchangeRatePrec),
        shareNames.principalName,
        shareNames.principalSymbol,
        shareNames.yieldName,
        shareNames.yieldSymbol,
        /*maxFeeSetup:*/{
          depositPercent:      yieldToken.toBigNum(0.5), // fees are stored in YBT
          earlyRedeemPercent:  yieldToken.toBigNum(1.0),
          matureRedeemPercent: yieldToken.toBigNum(0.5)
        }
      );
    } else {
      throw new Error("Unsupported PoolType "+type+" TempusPool.deploy failed");
    }

    // NOTE: Principals and Yields always have BackingToken precision
    const tps = await PoolShare.attach(ShareKind.Principal, await pool.principalShare(), asset.decimals);
    const tys = await PoolShare.attach(ShareKind.Yield, await pool.yieldShare(), asset.decimals);
    return new TempusPool(type, pool!, controller, asset, yieldToken, tps, tys, exchangeRatePrec);
  }

  /**
   * @returns Number of YBT deposited into this TempusPool contract
   */
  async contractBalance(): Promise<NumberOrString> {
    return this.yieldBearing.balanceOf(this.contract.address);
  }

  /**
   * Deposits yield bearing tokens into Tempus Pool on behalf of user
   * @param user User who is depositing
   * @param yieldBearingAmount Amount of Yield Bearing Tokens to deposit
   * @param recipient Address or User who will receive the minted shares
   */
  async deposit(user:SignerOrAddress, yieldBearingAmount:NumberOrString, recipient:SignerOrAddress): Promise<Transaction> {
    try {
      await this.yieldBearing.approve(user, this.contract.address, yieldBearingAmount);
      return this.connect(user).deposit(
        this.yieldBearing.toBigNum(yieldBearingAmount), addressOf(recipient)
      );
      // NOTE: we can't easily test the return value of a transaction, so it's omitted
    } catch(e) {
      throw new Error("TempusPool.deposit failed: " + e.message);
    }
  }

  /**
  * Deposits backing tokens into Tempus Pool on behalf of user
  * @param user User who is depositing
  * @param yieldBearingAmount Amount of Backing Tokens to deposit
  * @param recipient Address or User who will receive the minted shares
  */
  async depositBacking(user:SignerOrAddress, backingTokenAmount:NumberOrString, recipient:SignerOrAddress, ethValue: NumberOrString = 0): Promise<Transaction> {
    return this.connect(user).depositBacking(
      this.asset.toBigNum(backingTokenAmount), addressOf(recipient), { value: toWei(ethValue)}
    );
  }

  /**
   * Reedem shares from the Tempus Pool to Backing Tokens
   * @param user User who is depositing
   * @param principalAmount How many principal shares to redeem
   * @param yieldAmount How many yield shares to redeem
   * @param from Address of which Tempus Shares should be burned
   * @param recipient Address to which redeemed Backing Tokens should be transferred
   */
  async redeemToBacking(user:SignerOrAddress, principalAmount:NumberOrString, yieldAmount:NumberOrString, from: SignerOrAddress = user, recipient: SignerOrAddress = user): Promise<Transaction> {
    return this.contract.connect(user).redeemToBacking(
      addressOf(from), this.principalShare.toBigNum(principalAmount), this.yieldShare.toBigNum(yieldAmount), addressOf(recipient)
    );
  }

  /**
   * Reedem shares from the Tempus Pool
   * @param user User who is depositing
   * @param principalAmount How many principal shares to redeem
   * @param yieldAmount How many yield shares to redeem
   * @param from Address of which Tempus Shares should be burned
   * @param recipient Address to which redeemed Yield Bearing Tokens should be transferred
   */
  async redeem(user:SignerOrAddress, principalAmount:NumberOrString, yieldAmount:NumberOrString, from: SignerOrAddress = user, recipient: SignerOrAddress = user): Promise<Transaction> {
    try {
      return this.contract.connect(user).redeem(
        addressOf(from), this.principalShare.toBigNum(principalAmount), this.yieldShare.toBigNum(yieldAmount), addressOf(recipient)
      );
    } catch(e) {
      throw new Error("TempusPool.redeem failed: " + e.message);
    }
  }

  /**
   * @returns True if maturity has been reached and the pool was finalized.
   */
  async matured() {
    return this.contract.matured();
  }

  /**
   * @returns The version of the pool
   */
  async version(): Promise<NumberOrString> {
    return await this.contract.version();
  }

  async protocolName(): Promise<BytesLike> {
    return await this.contract.protocolName();
  }

  /**
   * @returns The start time of the pool
   */
  async startTime(): Promise<NumberOrString> {
    let start:BigNumber = await this.contract.startTime();
    return start.toNumber();
  }

  /**
   * @returns The maturity time of the pool
   */
  async maturityTime(): Promise<NumberOrString> {
    let maturity:BigNumber = await this.contract.maturityTime();
    return maturity.toNumber();
  }

  /**
   * @returns JS decimal converted to suitable contract Exchange Rate precision BigNumber
   */
  public toContractExchangeRate(decimal:NumberOrString): BigNumber {
    return parseDecimal(decimal, this.exchangeRatePrec);
  }

  /**
   * @returns Initial Interest Rate when the pool started
   */
  async initialInterestRate(): Promise<NumberOrString> {
    return formatDecimal(await this.contract.initialInterestRate(), this.exchangeRatePrec);
  }

  /**
   * @returns Current STORED Interest rate of the pool
   */
  async currentInterestRate(): Promise<NumberOrString> {
    return formatDecimal(await this.contract.currentInterestRate(), this.exchangeRatePrec);
  }

  /**
   * @returns Updated current Interest Rate
   */
  async updateInterestRate(): Promise<NumberOrString> {
    await this.contract.updateInterestRate();
    return this.currentInterestRate();
  }

  /**
   * @returns Interest rate at maturity of the pool
   */
  async maturityInterestRate(): Promise<NumberOrString> {
    return formatDecimal(await this.contract.maturityInterestRate(), this.exchangeRatePrec);
  }

  /**
   * @param amount Amount of BackingTokens or YieldBearingTokens that would be deposited
   * @param backingToken If true, @param amount is in BackingTokens, otherwise YieldBearingTokens
   * @return Amount of Principals (TPS) and Yields (TYS) in Principal/YieldShare decimal precision
   *         TPS and TYS are minted in 1:1 ratio, hence a single return value
   */
  async estimatedMintedShares(amount:NumberOrString, backingToken:boolean): Promise<NumberOrString> {
    return this.principalShare.fromBigNum(await this.contract.estimatedMintedShares(amount, backingToken));
  }

  async numAssetsPerYieldToken(amount:NumberOrString, interestRate:NumberOrString): Promise<NumberOrString> {
    return this.asset.fromBigNum(await this.contract.numAssetsPerYieldToken(
      this.yieldBearing.toBigNum(amount), this.toContractExchangeRate(interestRate)
    ));
  }

  async numYieldTokensPerAsset(amount:NumberOrString, interestRate:NumberOrString): Promise<NumberOrString> {
    return this.yieldBearing.fromBigNum(await this.contract.numYieldTokensPerAsset(
      this.asset.toBigNum(amount), this.toContractExchangeRate(interestRate)
    ));
  }

  async pricePerPrincipalShare(): Promise<NumberOrString> {
    return this.principalShare.fromBigNum(await this.contract.pricePerPrincipalShareStored());
  }

  async pricePerYieldShare(): Promise<NumberOrString> {
    return this.yieldShare.fromBigNum(await this.contract.pricePerYieldShareStored());
  }


  /**
   * @returns Total accumulated fees
   */
  async totalFees(): Promise<NumberOrString> {
    return this.yieldBearing.fromBigNum(await this.contract.totalFees());
  }

  async getFeesConfig(): Promise<TempusFeesConfig> {
    let feesConfig = await this.contract.getFeesConfig();
    return {
      depositPercent:      this.yieldBearing.fromBigNum(feesConfig.depositPercent),
      earlyRedeemPercent:  this.yieldBearing.fromBigNum(feesConfig.earlyRedeemPercent),
      matureRedeemPercent: this.yieldBearing.fromBigNum(feesConfig.matureRedeemPercent)
    }
  }

  /**
   * Sets fees config for the pool. Caller must be owner
   */
  async setFeesConfig(
    owner:SignerOrAddress,
    feesConfig: TempusFeesConfig
  ): Promise<void> {
    await this.contract.connect(owner).setFeesConfig({
      depositPercent:      this.yieldBearing.toBigNum(feesConfig.depositPercent),
      earlyRedeemPercent:  this.yieldBearing.toBigNum(feesConfig.earlyRedeemPercent),
      matureRedeemPercent: this.yieldBearing.toBigNum(feesConfig.matureRedeemPercent)
    });
  }
}

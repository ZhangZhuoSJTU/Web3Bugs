import { Contract, Transaction } from "ethers";
import { NumberOrString, toWei } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { TempusPool } from "./TempusPool";
import { ITestPool } from "../pool-utils/ITestPool";

/**
 * Wrapper around TempusController
 */
export class TempusController extends ContractBase {
  private static _contractName = "TempusController";
  private static _instance:TempusController = null;
  
  constructor(contractName: string, controller: Contract) {
    super(contractName, 18, controller);
  }

  /**
   * @returns The singleton instance of TempusController
   * @warning This cannot be used inside Test Fixture callback
   */
  static async instance(): Promise<TempusController> {
    if (TempusController._instance === null) {
      TempusController._instance = await this.deploy();
    }
    return TempusController._instance;
  }

  /**
   * Deploys a new instance of TempusController
   */
  static async deploy(): Promise<TempusController> {
    const controller = await ContractBase.deployContract(TempusController._contractName);
    return new TempusController(TempusController._contractName, controller);
  }

  /**
   * Deposits Yield Bearing Tokens into Tempus Pool on behalf of user
   * @param user User who is depositing
   * @param pool The Tempus Pool to which funds will be deposited
   * @param yieldBearingAmount Amount of Yield Bearing Tokens to deposit
   * @param recipient Address or User who will receive the minted shares
   * @param ethValue value of ETH to send with the tx
   */
  async depositYieldBearing(user:SignerOrAddress, pool: TempusPool, yieldBearingAmount:NumberOrString, recipient:SignerOrAddress = user, ethValue: NumberOrString = 0): Promise<Transaction> {
    await pool.yieldBearing.approve(user, this.contract.address, yieldBearingAmount);
    return this.connect(user).depositYieldBearing(
      pool.address, pool.yieldBearing.toBigNum(yieldBearingAmount),
      addressOf(recipient), { value: toWei(ethValue) }
    );
  }

  /**
  * Deposits backing tokens into Tempus Pool on behalf of user
  * @param user User who is depositing
  * @param pool The Tempus Pool to which funds will be deposited
  * @param backingAmount Amount of Backing Tokens to deposit
  * @param recipient Address or User who will receive the minted shares
  * @param ethValue value of ETH to send with the tx
  */
  async depositBacking(user:SignerOrAddress, pool: TempusPool, backingAmount:NumberOrString, recipient:SignerOrAddress = user, ethValue: NumberOrString = 0): Promise<Transaction> {
    return this.connect(user).depositBacking(
      pool.address, pool.asset.toBigNum(backingAmount),
      addressOf(recipient), { value: toWei(ethValue) }
    );
  }

  /**
   * Reedem shares from the Tempus Pool to Backing Tokens
   * @param user User who is depositing
   * @param pool The Tempus Pool from which shares will be redeemed
   * @param principalAmount How many principal shares to redeem
   * @param yieldAmount How many yield shares to redeem
   */
  async redeemToBacking(user:SignerOrAddress, pool: TempusPool, principalAmount:NumberOrString, yieldAmount:NumberOrString): Promise<Transaction> {
    return this.connect(user).redeemToBacking(
      pool.address, pool.principalShare.toBigNum(principalAmount), pool.yieldShare.toBigNum(yieldAmount), addressOf(user)
    );
  }

  /**
   * Reedem shares from the Tempus Pool to Yield Bearing Tokens
   * @param user User who is depositing
   * @param pool The Tempus Pool from which shares will be redeemed
   * @param principalAmount How many principal shares to redeem
   * @param yieldAmount How many yield shares to redeem
   */
  async redeemToYieldBearing(user:SignerOrAddress, pool: TempusPool, principalAmount:NumberOrString, yieldAmount:NumberOrString): Promise<Transaction> {
    return this.connect(user).redeemToYieldBearing(
      pool.address, pool.principalShare.toBigNum(principalAmount), pool.yieldShare.toBigNum(yieldAmount), addressOf(user)
    );
  }

  /**
   * Approves either BT or YBT transfer
   */
  async approve(pool:ITestPool, user:SignerOrAddress, amount:NumberOrString, isBackingToken:boolean) {
    const token = isBackingToken ? pool.asset() : pool.yieldToken();
    await token.approve(user, this.address, amount);
  }

  /**
   * Atomically deposits YBT/BT to TempusPool
   *  and provides liquidity to the corresponding Tempus AMM with the issued TYS & TPS
   * @param user The user to deposit on behalf of
   * @param amm The Tempus AMM for which liquidity will be provided
   * @param tokenAmount Amount of BT/YBT to deposit
   * @param isBackingToken Specifies whether the deposited asset is YBT or BT
   * @param ethValue value of ETH to send with the tx
   */
  async depositAndProvideLiquidity(
    pool: ITestPool,
    user: SignerOrAddress,
    tokenAmount: NumberOrString,
    isBackingToken: boolean,
    ethValue: NumberOrString = 0
  ): Promise<Transaction> {
    await this.approve(pool, user, tokenAmount, isBackingToken);
    const amount = isBackingToken ? pool.tempus.asset.toBigNum(tokenAmount) : pool.tempus.yieldBearing.toBigNum(tokenAmount);
    return this.connect(user).depositAndProvideLiquidity(
      pool.amm.address, amount, isBackingToken, { value: toWei(ethValue) }
    );
  }

  /**
   * Atomically deposits YBT/BT to TempusPool and swaps TYS for TPS to get fixed yield
   * @param user The user to deposit on behalf of
   * @param amm The corresponding Tempus AMM to use to swap TYS for TPS
   * @param tokenAmount Amount of BT/YBT to deposit
   * @param isBackingToken Specifies whether the deposited asset is YBT or BT
   * @param minTYSRate Minimum TYS rate (denominated in TPS) to receive in exchange to TPS
   * @param ethValue value of ETH to send with the tx
   */
  async depositAndFix(
    pool: ITestPool,
    user: SignerOrAddress,
    tokenAmount: NumberOrString,
    isBackingToken: boolean,
    minTYSRate: NumberOrString,
    ethValue: NumberOrString = 0
  ): Promise<Transaction> {
    await this.approve(pool, user, tokenAmount, isBackingToken);
    const amount = isBackingToken ? pool.tempus.asset.toBigNum(tokenAmount) : pool.tempus.yieldBearing.toBigNum(tokenAmount);
    return this.connect(user).depositAndFix(
      pool.amm.address, amount, isBackingToken, pool.tempus.asset.toBigNum(minTYSRate), { value: toWei(ethValue) }
    );
  }

  async provideLiquidity(
    pool: ITestPool,
    user: SignerOrAddress,
    sharesAmount: NumberOrString
  ): Promise<Transaction> {
    await pool.tempus.yieldShare.approve(user, this.address, sharesAmount);
    await pool.tempus.principalShare.approve(user, this.address, sharesAmount);
    return this.connect(user).provideLiquidity(pool.amm.address, pool.tempus.principalShare.toBigNum(sharesAmount));
  }

  async exitTempusAMMAndRedeem(
    pool: ITestPool,
    user: SignerOrAddress,
    principals: NumberOrString,
    yields: NumberOrString,
    principalsLp: NumberOrString,
    yieldsLp: NumberOrString,
    toBackingToken: boolean
  ): Promise<Transaction> {
    const amm = pool.amm, t = pool.tempus;
    await amm.contract.connect(user).approve(this.address, amm.contract.balanceOf(addressOf(user)));
    await t.principalShare.approve(user, t.address, principals);
    await t.yieldShare.approve(user, t.address, yields);
    return this.connect(user).exitTempusAMMAndRedeem(
      amm.address,
      t.principalShare.toBigNum(principals),
      t.yieldShare.toBigNum(yields),
      t.principalShare.toBigNum(principalsLp),
      t.yieldShare.toBigNum(yieldsLp),
      amm.contract.balanceOf(addressOf(user)),
      toBackingToken
    );
  }

  async exitTempusAmm(
    pool: ITestPool,
    user: SignerOrAddress,
    lpTokensAmount: Number
  ): Promise<Transaction> {
    const amm = pool.amm;
    await amm.contract.connect(user).approve(this.address, amm.contract.balanceOf(addressOf(user)));
    return this.connect(user).exitTempusAMM(amm.address, pool.amm.toBigNum(lpTokensAmount), 1, 1, false);
  }

  async exitTempusAmmAndRedeem(
    pool:ITestPool, 
    user: SignerOrAddress, 
    lpTokens:NumberOrString, 
    principals:NumberOrString, 
    yields:NumberOrString, 
    toBacking: boolean
  ): Promise<Transaction> {
    const amm = pool.amm, t = pool.tempus, addr = addressOf(user);
    await amm.connect(user).approve(this.address, amm.contract.balanceOf(addr));
    await t.principalShare.connect(user).approve(this.address, t.principalShare.contract.balanceOf(addr));
    await t.yieldShare.connect(user).approve(this.address, t.yieldShare.contract.balanceOf(addr));

    let maxLeftoverShares;
    if (t.principalShare.decimals == 18) { // ETH, DAI
      maxLeftoverShares = t.principalShare.toBigNum("0.000001");
    } else if (t.principalShare.decimals == 6) { // this convers USDC
      maxLeftoverShares = t.principalShare.toBigNum("0.01");
    } else {
      // if you get this error, add a new case with suitable maxLeftoverShares precision
      throw new Error("Cannot determine maxLeftoverShares for principal decimals="+t.principalShare.decimals);
    }

    return this.connect(user).exitTempusAmmAndRedeem(
      amm.address,
      amm.toBigNum(lpTokens),
      amm.principalShare.toBigNum(principals),
      amm.yieldShare.toBigNum(yields),
      0,
      0,
      maxLeftoverShares,
      toBacking
    );
  }

  /**
   * Finalize the pool after maturity.
   */ 
  async finalize(pool:ITestPool): Promise<void> {
    await this.contract.finalize(pool.tempus.address);
  }

  /**
   * Transfers fees from contract to recipient
   */
  async transferFees(pool:ITestPool, owner:SignerOrAddress, recipient:SignerOrAddress) {
    await this.connect(owner).transferFees(pool.tempus.address, addressOf(recipient));
  }
}

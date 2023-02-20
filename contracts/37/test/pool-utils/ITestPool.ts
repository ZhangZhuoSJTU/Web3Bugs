import { expect } from "chai";
import { Transaction } from "ethers";
import { ethers, deployments } from "hardhat";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { TempusPool, PoolType, TempusSharesNames, generateTempusSharesNames } from "../utils/TempusPool";
import { blockTimestamp, setEvmTime, setNextBlockTimestamp } from "../utils/Utils";
import { ERC20 } from "../utils/ERC20";
import { NumberOrString } from "../utils/Decimal";
import { getRevertMessage } from "../utils/Utils";
import { TempusController } from "../utils/TempusController";
import { TempusAMM } from "../utils/TempusAMM";

export class UserState {
  principalShares:Number;
  yieldShares:Number;
  yieldBearing:Number;
  yieldPeggedToAsset:boolean;

  // non-async to give us actual test failure line #
  public expectMulti(principalShares:number, yieldShares:number, yieldBearingPegged:number, yieldBearingVariable:number, message:string = null) {
    const msg = message ? (": expected " + message) : "";
    expect(this.principalShares).to.equal(principalShares, "principalShares did not match expected value"+msg);
    expect(this.yieldShares).to.equal(yieldShares, "yieldShares did not match expected value"+msg);
    expect(this.yieldBearing).to.equal(this.yieldPeggedToAsset ? yieldBearingPegged : yieldBearingVariable, "yieldBearing did not match expected value"+msg);
  }

  // non-async to give us actual test failure line #
  public expect(principalShares:number, yieldShares:number, yieldBearing:number, message:string = null) {
    const msg = message ? (": expected " + message) : "";
    expect(this.principalShares).to.equal(principalShares, ("principalShares did not match expected value"+msg));
    expect(this.yieldShares).to.equal(yieldShares, ("yieldShares did not match expected value"+msg));
    expect(this.yieldBearing).to.equal(yieldBearing, ("yieldBearing did not match expected value"+msg));
  }
}

// Stores all required state for a unique ITestPool fixture
export class FixtureState {
  maturityTime:number; // UNIX timestamp in milliseconds
  names:TempusSharesNames;
  getInitialContractState:(options?: any)=>Promise<any>;
  constructor(maturityTime:number, names:TempusSharesNames, getState:(options?: any)=>Promise<any>) {
    this.maturityTime = maturityTime;
    this.names = names;
    this.getInitialContractState = getState;
  }
}

export interface TempusParams {
  initialRate:number; // Initial interest rate
  poolDuration:number; // Pool lifetime duration in seconds
  yieldEst:number; // Estimated initial yield of the pool
}

export interface TempusAMMParams {
  initialRate:number; // Initial interest rate
  poolDuration:number; // Pool lifetime duration in seconds
  yieldEst:number; // Estimated initial yield of the pool
  ammSwapFee:number; // Swap fee percentage for TempusAMM
  ammAmplification:number; // Amplification parameter for TempusAMM
}

// When we create TestPool fixtures with different parameters,
// each parameter set is kept separately here
const POOL_FIXTURES: { [signature: string]: FixtureState } = {};

export abstract class ITestPool {
  type:PoolType;

  // if true, underlying pool pegs YieldToken 1:1 to BackingToken
  // ex true: deposit(100) with rate 1.0 will yield 100 TPS and TYS
  // ex false: deposit(100) with rate 1.2 will yield 120 TPS and TYS
  yieldPeggedToAsset:boolean;

  // initialized by initPool()
  tempus:TempusPool;
  controller:TempusController;
  amm:TempusAMM;
  signers:Signer[];

  // common state reset when a fixture is instantiated
  initialRate:number; // initial interest rate
  yieldEst:number; // initial estimated yield
  maturityTime:number; // UNIX timestamp in milliseconds
  poolDuration:number; // pool duration in seconds
  names:TempusSharesNames;

  constructor(type:PoolType, yieldPeggedToAsset:boolean) { 
    this.type = type;
    this.yieldPeggedToAsset = yieldPeggedToAsset;
  }

  /**
   * @return The underlying pool contract, such as Aave, Lido or Comptroller
   */
  abstract pool(): ContractBase;

  /**
   * @return The underlying asset token of the backing pool
   */
  abstract asset(): ERC20;

  /**
   * @return The yield token of the backing tool
   */
  abstract yieldToken(): ERC20;

  /**
   * @return Current Yield Bearing Token balance of the user
   */
  abstract yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString>;

  /**
   * @return Current Backing Token balance of the user
   */
  async backingTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.asset().balanceOf(user);
  }

  /**
   * This will create TempusPool, TempusAMM and TempusController instances.
   * @param params Parameters for Pool, AMM and 
   */
  abstract createWithAMM(params:TempusAMMParams): Promise<TempusPool>;

  /**
   * Simplified overload for createPoolWithAMM, giving default parameters for AMM
   */
  public create(params:TempusParams): Promise<TempusPool> {
    return this.createWithAMM({ ...params, ammSwapFee:0.02, ammAmplification:5 });
  }

  /**
   * Super-simplified overload for create, sets default parameters
   */
  public createDefault(): Promise<TempusPool> {
    return this.create({ initialRate:1.0, poolDuration:60*60, yieldEst:0.1 });
  }

  /**
   * @param rate Sets the Interest Rate for the underlying mock pool
   */
  abstract setInterestRate(rate:number): Promise<void>;

  /**
   * Deposit BackingTokens into the UNDERLYING pool and receive YBT
   */
  abstract deposit(user:Signer, amount:number): Promise<void>;

  /**
   * Sets force fail on next deposit or redeem call
   */
  abstract forceFailNextDepositOrRedeem(): Promise<void>;

  /**
   * Deposit YieldBearingTokens into TempusPool
   */
  async depositYBT(user:Signer, yieldBearingAmount:NumberOrString, recipient:Signer = user): Promise<Transaction> {
    return this.tempus.controller.depositYieldBearing(user, this.tempus, yieldBearingAmount, recipient);
  }

  /**
   * Deposit BackingTokens into TempusPool
   */
  async depositBT(user:Signer, backingTokenAmount:NumberOrString, recipient:Signer = user): Promise<Transaction> {
    return this.tempus.controller.depositBacking(user, this.tempus, backingTokenAmount, recipient);
  }

  /**
   * Redeems TempusShares to YieldBearingTokens
   */
  async redeemToYBT(user:Signer, principalAmount:NumberOrString, yieldAmount:NumberOrString): Promise<Transaction> {
    return this.tempus.controller.redeemToYieldBearing(user, this.tempus, principalAmount, yieldAmount);
  }

  /**
   * Redeems TempusShares to BackingTokens
   */
  async redeemToBT(user:Signer, principalAmount:NumberOrString, yieldAmount:NumberOrString): Promise<Transaction> {
    return this.tempus.controller.redeemToBacking(user, this.tempus, principalAmount, yieldAmount);
  }

  /**
   * Deposit YieldBearingTokens into TempusPool, and return a testable `expect()` object.
   * This is set up so we are able to report TEST failure File and Line:
   * @example (await pool.expectDepositYBT(user, 100)).to.equal('success');
   * @returns RevertMessage assertion, or 'success' assertion
   */
  async expectDepositYBT(user:Signer, yieldBearingAmount:NumberOrString, recipient:Signer = user): Promise<Chai.Assertion> {
    try {
      await this.depositYBT(user, yieldBearingAmount, recipient);
      return expect('success');
    } catch(e) {
      return expect(getRevertMessage(e));
    }
  }

  /**
   * Deposit BackingTokens into TempusPool, and return a testable `expect()` object.
   * This is set up so we are able to report TEST failure File and Line:
   * @example (await pool.expectDepositBT(user, 100)).to.equal('success');
   * @returns RevertMessage assertion, or 'success' assertion
   */
  async expectDepositBT(user:Signer, backingTokenAmount:NumberOrString, recipient:Signer = user): Promise<Chai.Assertion> {
    try {
      await this.depositBT(user, backingTokenAmount, recipient);
      return expect('success');
    } catch(e) {
      return expect(getRevertMessage(e));
    }
  }

  /**
   * Redeem YieldBearingTokens from TempusPool, and return a testable `expect()` object.
   * This is set up so we are able to report TEST failure File and Line:
   * @example (await pool.expectRedeemYBT(user, 100, 100)).to.equal('success');
   * @returns RevertMessage assertion, or 'success' assertion
   */
  async expectRedeemYBT(user:Signer, principalShares:NumberOrString, yieldShares:NumberOrString): Promise<Chai.Assertion> {
    try {
      await this.redeemToYBT(user, principalShares, yieldShares);
      return expect('success');
    } catch(e) {
      return expect(getRevertMessage(e));
    }
  }

  /**
   * Redeem BackingTokens from TempusPool, and return a testable `expect()` object.
   * This is set up so we are able to report TEST failure File and Line:
   * @example (await pool.expectRedeemYBT(user, 100, 100)).to.equal('success');
   * @returns RevertMessage assertion, or 'success' assertion
   */
  async expectRedeemBT(user:Signer, principalShares:NumberOrString, yieldShares:NumberOrString): Promise<Chai.Assertion> {
    try {
      await this.redeemToBT(user, principalShares, yieldShares);
      return expect('success');
    } catch(e) {
      return expect(getRevertMessage(e));
    }
  }

  /**
   * Finalize the pool after maturity
   */
  async finalize(): Promise<void> {
    return this.controller.finalize(this);
  }

  /**
   * Fast forwards time to after maturity and Finalized the pool
   */
  async fastForwardToMaturity(): Promise<void> {
    await setEvmTime(this.maturityTime + 1);
    return this.controller.finalize(this);
  }

  /**
   * Fast forwards time to certain point in time
   */
  async setTimeRelativeToPoolStart(percentDuration: number): Promise<void> {
    const startTime:number = +await this.tempus.startTime();
    const duration:number = +await this.tempus.maturityTime() - startTime;
    await setEvmTime(startTime + percentDuration * duration);
  }

  /**
   * Sets the next block timestamp relative to the pool's duration (without mining a block)
   */
  async setNextBlockTimestampRelativeToPoolStart(percentDuration: number): Promise<void> {
    const startTime:number = +await this.tempus.startTime();
    const duration:number = +await this.tempus.maturityTime() - startTime;
    await setNextBlockTimestamp(startTime + percentDuration * duration);
  }

  /**
   * Typical setup call for most tests
   * 1. Deposits Asset into underlying pool by Owner
   * 1. Transfers Assets from Owner to depositors[]
   * 2. Transfers YBT from Owner to depositors[]
   */
  async setupAccounts(owner:Signer, depositors:[Signer,number][]): Promise<void> {
    if (!this.tempus)
      throw new Error('setupAccounts: createPool() not called');
    
    const totalDeposit = depositors.reduce((sum, current) => sum + current[1], 100);
    await this.deposit(owner, totalDeposit);

    for (let depositor of depositors) { // initial deposit for users
      const user = depositor[0];
      const amount = depositor[1];
      await this.asset().transfer(owner, user, 100000); // TODO: make this a parameter?
      await this.tempus.yieldBearing.transfer(owner, user, amount);
    }
  }

  /**
   * @returns Balances state for a single user
   */
  async userState(user:Signer): Promise<UserState> {
    let state = new UserState();
    state.principalShares = Number(await this.tempus.principalShare.balanceOf(user));
    state.yieldShares = Number(await this.tempus.yieldShare.balanceOf(user));
    state.yieldBearing = Number(await this.yieldTokenBalance(user));
    state.yieldPeggedToAsset = this.yieldPeggedToAsset;
    return state;
  }

  protected async initPool(
    p:TempusAMMParams,
    ybtName:string,
    ybtSymbol:string,
    newPool:()=>Promise<ContractBase>,
    setPool:(pool:ContractBase)=>void
  ): Promise<TempusPool> {
    this.initialRate = p.initialRate;
    this.poolDuration = p.poolDuration;
    this.yieldEst = p.yieldEst;

    const sig = [this.type, ybtSymbol, p.initialRate, p.poolDuration, p.yieldEst, p.ammSwapFee, p.ammAmplification].join("|");
    let f:FixtureState = POOL_FIXTURES[sig];

    if (!f) // initialize a new fixture
    {
      const controller = await TempusController.instance();
      const maturityTime = await blockTimestamp() + this.poolDuration;
      const names = generateTempusSharesNames(ybtName, ybtSymbol, maturityTime);
      f = new FixtureState(maturityTime, names, deployments.createFixture(async () =>
      {
        const startTime = Date.now();

        await deployments.fixture(undefined, { keepExistingDeployments: true, });
        // Note: for fixtures, all contracts must be initialized inside this callback
        const [owner,user,user2] = await ethers.getSigners();
        const pool = await newPool();
        const asset = (pool as any).asset;
        const ybt = (pool as any).yieldToken;
        const tempus = await TempusPool.deploy(
          this.type, controller, asset, ybt, maturityTime, p.yieldEst, names
        );
        const amm = await TempusAMM.create(owner, p.ammAmplification, p.ammSwapFee, tempus);

        // always report the instantiation of new fixtures,
        // because this is a major test bottleneck
        const elapsed = Date.now() - startTime;
        console.log('    createFixture %s %sms', sig, elapsed);
        return {
          signers: { owner:owner, user:user, user2:user2 },
          contracts: { pool:pool, tempus:tempus, amm: amm },
        };
      }));
      POOL_FIXTURES[sig] = f; // save for later use
    }

    // always restore pool from fixture (that's just the way the fixture approach works bro)
    const s = await f.getInitialContractState();
    this.maturityTime = f.maturityTime;
    this.names = f.names;
    this.signers = [s.signers.owner, s.signers.user, s.signers.user2];

    setPool(s.contracts.pool);
    this.tempus = s.contracts.tempus;
    this.controller = this.tempus.controller;
    this.amm = s.contracts.amm;
    return this.tempus;
  }
}


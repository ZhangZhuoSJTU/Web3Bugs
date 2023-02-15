import { ethers } from "hardhat";
import { BigNumber, Contract, Transaction } from "ethers";
import { NumberOrString, toWei, fromWei } from "./Decimal";
import { ContractBase } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { MockProvider } from "@ethereum-waffle/provider";
import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { blockTimestamp, setEvmTime } from "./Utils";
import { TempusPool } from "./TempusPool";

const WETH_ARTIFACTS = require("../../artifacts/@balancer-labs/v2-solidity-utils/contracts/misc/IWETH.sol/IWETH");

export const SECOND = 1;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
export const MONTH = DAY * 30;

export enum TempusAMMExitKind {
  EXACT_BPT_IN_FOR_TOKENS_OUT = 0,
  BPT_IN_FOR_EXACT_TOKENS_OUT,
  INVALID
}

export enum TempusAMMJoinKind {
  INIT = 0,  // first join to the pool, needs to pick token balances
  EXACT_TOKENS_IN_FOR_BPT_OUT,  // joining with exact amounts of both tokens
  INVALID  // used to test invalid join type
}

export class TempusAMM extends ContractBase {
  vault: Contract;
  principalShare: ERC20;
  yieldShare: ERC20;
  tempusPool: TempusPool;
  startAmp: number;
  targetAmp: number;
  startedAmpUpdateTime: number;
  oneAmpUpdateTime: number;

  constructor(tempusAmmPool: Contract, vault: Contract, tempusPool: TempusPool) {
    super("TempusAMM", 18, tempusAmmPool);
    this.vault = vault;
    this.tempusPool = tempusPool;
    this.principalShare = tempusPool.principalShare;
    this.yieldShare = tempusPool.yieldShare;
  }

  static async create(
    owner: SignerWithAddress,
    amplification: Number,
    swapFeePercentage: Number, 
    tempusPool: TempusPool
  ): Promise<TempusAMM> {
    const [sender] = new MockProvider().getWallets();
    const mockedWETH = await deployMockContract(sender, WETH_ARTIFACTS.abi);

    const authorizer = await ContractBase.deployContract("@balancer-labs/v2-vault/contracts/Authorizer.sol:Authorizer", owner.address);
    const vault = await ContractBase.deployContract("@balancer-labs/v2-vault/contracts/Vault.sol:Vault", authorizer.address, mockedWETH.address, 3 * MONTH, MONTH);

    let tempusAMM = await ContractBase.deployContract(
      "TempusAMM", 
      vault.address, 
      "Tempus LP token", 
      "LP", 
      tempusPool.address,
      amplification, 
      toWei(swapFeePercentage),
      3 * MONTH, 
      MONTH, 
      owner.address
    );

    return new TempusAMM(tempusAMM, vault, tempusPool);
  }

  async getLastInvariant(): Promise<{invariant: number, amplification: number}> {
    let inv:BigNumber;
    let amp: number;
    [inv, amp] = await this.contract.getLastInvariant();
    return {invariant: +this.fromBigNum(inv), amplification: amp};
  }

  async balanceOf(user:SignerWithAddress): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.balanceOf(user.address));
  }

  async totalSupply(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.totalSupply());
  }

  async getRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getRate());
  }

  async getExpectedReturnGivenIn(inAmount: NumberOrString, yieldShareIn: boolean) : Promise<NumberOrString> {
    return this.principalShare.fromBigNum(await this.contract.getExpectedReturnGivenIn(this.principalShare.toBigNum(inAmount), yieldShareIn));
  }

  async getExpectedTokensOutGivenBPTIn(inAmount: NumberOrString): Promise<{principals:number, yields:number}> {
    const p = await this.contract.getExpectedTokensOutGivenBPTIn(this.toBigNum(inAmount));
    return {principals: +this.principalShare.fromBigNum(p.principals), yields: +this.yieldShare.fromBigNum(p.yields)};
  }

  async getExpectedLPTokensForTokensIn(principalsIn:NumberOrString, yieldsIn:NumberOrString): Promise<NumberOrString> {
    const assets = [
      { address: this.principalShare.address, amount: this.principalShare.toBigNum(principalsIn) },
      { address: this.yieldShare.address, amount: this.yieldShare.toBigNum(yieldsIn) }
    ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));
    const amountsIn = assets.map(({ amount }) => amount);

    return +this.fromBigNum(await this.contract.getExpectedLPTokensForTokensIn(amountsIn));
  }

  /**
   * @dev queries exiting TempusAMM with exact tokens out
   * @param principalsStaked amount of Principals to withdraw
   * @param yieldsStaked amount of Yields to withdraw
   * @return lpTokens Amount of Lp tokens that user would redeem
   */
  async getExpectedBPTInGivenTokensOut(principalsStaked:NumberOrString, yieldsStaked:NumberOrString): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getExpectedBPTInGivenTokensOut(
      this.principalShare.toBigNum(principalsStaked),
      this.yieldShare.toBigNum(yieldsStaked)
    ));
  }

  async provideLiquidity(from: SignerWithAddress, principalShareBalance: Number, yieldShareBalance: Number, joinKind: TempusAMMJoinKind) {
    await this.principalShare.approve(from, this.vault.address, principalShareBalance);
    await this.yieldShare.approve(from, this.vault.address, yieldShareBalance);
    
    const poolId = await this.contract.getPoolId();
    const assets = [
      { address: this.principalShare.address, amount: this.principalShare.toBigNum(principalShareBalance) },
      { address: this.yieldShare.address, amount: this.yieldShare.toBigNum(yieldShareBalance) }
    ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));
    
    const initialBalances = assets.map(({ amount }) => amount);
    const initUserData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256[]'], [joinKind, initialBalances]
    );
    const joinPoolRequest = {
      assets: assets.map(({ address }) => address),
      maxAmountsIn: initialBalances,
      userData: initUserData,
      fromInternalBalance: false
    };
  
    await this.vault.connect(from).joinPool(poolId, from.address, from.address, joinPoolRequest);
  }

  async exitPoolExactLpAmountIn(from: SignerWithAddress, lpTokensAmount: Number) {
    const poolId = await this.contract.getPoolId();
    
    const assets = [
      { address: this.principalShare.address },
      { address: this.yieldShare.address }
    ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));

    const exitUserData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256'], 
      [TempusAMMExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT, this.toBigNum(lpTokensAmount)]
    );
    
    const exitPoolRequest = {
      assets: assets.map(({ address }) => address),
      minAmountsOut: [1000000, 100000],
      userData: exitUserData,
      toInternalBalance: false
    };
  
    await this.vault.connect(from).exitPool(poolId, from.address, from.address, exitPoolRequest);
  }

  async exitPoolExactAmountOut(from:SignerWithAddress, amountsOut:Number[], maxAmountLpIn:Number) {
    const poolId = await this.contract.getPoolId();
    
    const assets = [
      { address: this.principalShare.address, amountOut: this.principalShare.toBigNum(amountsOut[0]) },
      { address: this.yieldShare.address, amountOut: this.principalShare.toBigNum(amountsOut[1]) }
    ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));

    const exitUserData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256[]', 'uint256'], 
      [TempusAMMExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT, assets.map(({ amountOut }) => amountOut), this.toBigNum(maxAmountLpIn)],
    );
    
    const exitPoolRequest = {
      assets: assets.map(({ address }) => address),
      minAmountsOut: [1000000, 100000],
      userData: exitUserData,
      toInternalBalance: false
    };
  
    await this.vault.connect(from).exitPool(poolId, from.address, from.address, exitPoolRequest);
  }

  async swapGivenIn(from: SignerWithAddress, assetIn: string, assetOut: string, amount: NumberOrString) {    
    await this.yieldShare.connect(from).approve(this.vault.address, this.yieldShare.toBigNum(amount));
    await this.principalShare.connect(from).approve(this.vault.address, this.principalShare.toBigNum(amount));
    const SWAP_KIND_GIVEN_IN = 0;
    const poolId = await this.contract.getPoolId();    

    const singleSwap = {
      poolId,
      kind: SWAP_KIND_GIVEN_IN,
      assetIn: assetIn,
      assetOut: assetOut,
      amount: this.principalShare.toBigNum(amount),
      userData: 0x0
    };
  
    const fundManagement = {
      sender: from.address,
      fromInternalBalance: false,
      recipient: from.address,
      toInternalBalance: false
    };
    const minimumReturn = 1;
    const deadline = await blockTimestamp() * 2; // not anytime soon 
    await this.vault.connect(from).swap(singleSwap, fundManagement, minimumReturn, deadline);
  }

  async startAmplificationUpdate(ampTarget: number, oneAmpUpdateTime: number): Promise<Transaction> {
    this.targetAmp = ampTarget;
    this.oneAmpUpdateTime = oneAmpUpdateTime;
    this.startedAmpUpdateTime = await blockTimestamp();
    const ampParam = await this.getAmplificationParam();
    this.startAmp = +ampParam.value / +ampParam.precision;

    const ampDiff = (ampTarget > this.startAmp) ? (ampTarget - this.startAmp) : (this.startAmp - ampTarget);
    const endTime = this.startedAmpUpdateTime + ampDiff * oneAmpUpdateTime;
    return this.contract.startAmplificationParameterUpdate(ampTarget, endTime);
  }

  async forwardToAmplification(ampValue: number): Promise<void> {
    let targetTimestamp: number;
    if (this.startAmp == ampValue) {
      targetTimestamp = 0;
    }
    else if (this.targetAmp > this.startAmp) {
      if (ampValue > this.targetAmp || ampValue < this.startAmp) { 
        throw console.error("Wrong amplification update!"); 
      }
      targetTimestamp = this.startedAmpUpdateTime + (ampValue - this.startAmp) * this.oneAmpUpdateTime;
    } else {
      if (ampValue < this.targetAmp || ampValue > this.startAmp) { 
        throw console.error("Wrong amplification update!"); 
      }
      targetTimestamp = this.startedAmpUpdateTime + (this.startAmp - ampValue) * this.oneAmpUpdateTime;
    }

    if (targetTimestamp > 0) {
      return setEvmTime(targetTimestamp);
    }
  }

  async stopAmplificationUpdate(): Promise<Transaction> {
    return this.contract.stopAmplificationParameterUpdate();
  }

  async getAmplificationParam(): Promise<{value:NumberOrString, isUpdating:NumberOrString, precision:NumberOrString}> {
    return this.contract.getAmplificationParameter();
  }
}

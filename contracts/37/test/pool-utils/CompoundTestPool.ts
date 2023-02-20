import { ITestPool, TempusAMMParams } from "./ITestPool";
import { TokenInfo } from "./TokenInfo";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool, PoolType } from "../utils/TempusPool";
import { Comptroller } from "../utils/Comptroller";
import { NumberOrString } from "test/utils/Decimal";

// Compound CErc20
export class CompoundTestPool extends ITestPool {
  compound:Comptroller;
  ASSET_TOKEN:TokenInfo;
  YIELD_TOKEN:TokenInfo;
  constructor(ASSET_TOKEN:TokenInfo, YIELD_TOKEN:TokenInfo) {
    super(PoolType.Compound, /*yieldPeggedToAsset:*/false);
    this.ASSET_TOKEN = ASSET_TOKEN;
    this.YIELD_TOKEN = YIELD_TOKEN;
  }
  public pool(): ContractBase {
    return this.compound;
  }
  public asset(): ERC20 {
    return this.compound.asset;
  }
  public yieldToken(): ERC20 {
    return this.compound.yieldToken;
  }
  async yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.compound.yieldToken.balanceOf(user);
  }
  async setInterestRate(rate:number): Promise<void> {
    return this.compound.setExchangeRate(rate);
  }
  async forceFailNextDepositOrRedeem(): Promise<void> {
    await this.compound.contract.setFailNextDepositOrRedeem(true);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.compound.enterMarkets(user);
    await this.compound.mint(user, amount);
  }

  async createWithAMM(params:TempusAMMParams): Promise<TempusPool> {
    return await this.initPool(params, this.YIELD_TOKEN.name, this.YIELD_TOKEN.symbol, async () => {
      return await Comptroller.create(this.ASSET_TOKEN, this.YIELD_TOKEN, this.initialRate);
    }, (pool:ContractBase) => {
      this.compound = <Comptroller>pool;
    });
  }
}

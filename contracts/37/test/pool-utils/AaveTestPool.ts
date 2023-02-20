import { ITestPool, TempusAMMParams } from "./ITestPool";
import { TokenInfo } from "./TokenInfo";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool, PoolType } from "../utils/TempusPool";
import { Aave } from "../utils/Aave";
import { NumberOrString } from "../utils/Decimal";

export class AaveTestPool extends ITestPool {
  aave:Aave;
  ASSET_TOKEN:TokenInfo;
  YIELD_TOKEN:TokenInfo;
  constructor(ASSET_TOKEN:TokenInfo, YIELD_TOKEN:TokenInfo) {
    super(PoolType.Aave, /*yieldPeggedToAsset:*/true);
    this.ASSET_TOKEN = ASSET_TOKEN;
    this.YIELD_TOKEN = YIELD_TOKEN;
  }
  public pool(): ContractBase {
    return this.aave;
  }
  public asset(): ERC20 {
    return this.aave.asset;
  }
  public yieldToken(): ERC20 {
    return this.aave.yieldToken;
  }
  async yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.aave.yieldToken.balanceOf(user);
  }
  async setInterestRate(rate:number): Promise<void> {
    await this.aave.setLiquidityIndex(rate);
  }
  async forceFailNextDepositOrRedeem(): Promise<void> {
    await this.aave.contract.setFailNextDepositOrRedeem(true);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.aave.deposit(user, amount);
  }

  async createWithAMM(params:TempusAMMParams): Promise<TempusPool> {
    return await this.initPool(params, this.YIELD_TOKEN.name, this.YIELD_TOKEN.symbol, async () => {
      return await Aave.create(this.ASSET_TOKEN, this.YIELD_TOKEN, this.initialRate);
    }, (pool:ContractBase) => {
      this.aave = <Aave>pool;
    });
  }
}

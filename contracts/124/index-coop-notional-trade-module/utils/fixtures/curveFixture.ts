import { providers } from "ethers";
import { Address } from "../types";
import DeployHelper from "../deploys";
import { Signer } from "ethers";
import { CurvePoolERC20 } from "../../typechain/CurvePoolERC20";
import { Stableswap } from "../../typechain/Stableswap";
import { CurveDeposit } from "../../typechain/CurveDeposit";
import { CurveStableswapMock } from "../../typechain/CurveStableswapMock";
import { CRVToken } from "../../typechain/CRVToken";
import { GaugeController } from "../../typechain/GaugeController";
import { Minter } from "../../typechain/Minter";
import { LiquidityGaugeReward } from "../../typechain/LiquidityGaugeReward";
import { LiquidityGauge } from "../../typechain/LiquidityGauge";
import { ether } from "../common";

export class CurveFixture {
  private _deployer: DeployHelper;
  private _ownerSigner: Signer;

  public poolToken: CurvePoolERC20;
  public stableSwap: Stableswap;
  public deposit: CurveDeposit;

  public crvToken: CRVToken;
  public gaugeController: GaugeController;
  public minter: Minter;

  constructor(provider: providers.Web3Provider | providers.JsonRpcProvider, ownerAddress: Address) {
    this._ownerSigner = provider.getSigner(ownerAddress);
    this._deployer = new DeployHelper(this._ownerSigner);
  }

  /**
   * Initializes a pool.
   *
   * @param _tokens Expects 4 tokens
   */
  public async initializePool(_tokens: [string, string, string, string]): Promise<void> {
    this.poolToken = await this._deployer.external.deployCurvePoolERC20(
      "Curve.fi DAI/USDC/USDT/sUSD",
      "crvUSD",
      18,
      0
    );

    this.stableSwap = await this._deployer.external.deployStableswap(_tokens, _tokens, this.poolToken.address);

    this.deposit = await this._deployer.external.deployCurveDeposit(
      _tokens,
      _tokens,
      this.stableSwap.address,
      this.poolToken.address
    );

    await this.poolToken.set_minter(this.stableSwap.address);
  }

  /**
   * Initializes contracts for staking LP tokens and generate CRV token.
   */
  public async initializeDAO(): Promise<void> {
    this.crvToken = await this._deployer.external.deployCrvToken("Curve DAO Token", "CRV");

    this.gaugeController = await this._deployer.external.deployGaugeController(this.crvToken.address, this.crvToken.address);
    await this.gaugeController["add_type(string,uint256)"]("Liquidity", ether(0.5));

    this.minter = await this._deployer.external.deployMinter(this.crvToken.address, this.gaugeController.address);

    await this.crvToken.set_minter(this.minter.address);
  }

  /**
   * Initializes a gauge.
   */
  public async initializeGauge(_lpToken: string): Promise<LiquidityGauge> {
    const gauge = await this._deployer.external.deployLiquidityGauge(_lpToken, this.minter.address);

    await this.gaugeController.functions["add_gauge(address,int128,uint256)"](gauge.address, 0, ether(1));
    return gauge;
  }

  /**
   * Initializes a gauge with rewards for a LP token on external protocol contracts.
   */
  public async initializeGaugeRewards(
    _lpToken: string,
    _rewardContract: string,
    _rewardedToken: string,
  ): Promise<LiquidityGaugeReward> {
    const gauge = await this._deployer.external.deployLiquidityGaugeReward(
      _lpToken,
      this.minter.address,
      _rewardContract,
      _rewardedToken
    );

    await this.gaugeController["add_gauge(address,int128,uint256)"](gauge.address, 0, ether(1));

    return gauge;
  }

  public async getForkedCurveStEthStableswapPool(): Promise<CurveStableswapMock> {
    return await this._deployer.external.getCurveStEthStableswapMock();
  }

  public async getForkedWethStethCurveStableswapPool(): Promise<CurveStableswapMock> {
    return await this._deployer.external.getCurveWethStethStableswapMock();
  }
}

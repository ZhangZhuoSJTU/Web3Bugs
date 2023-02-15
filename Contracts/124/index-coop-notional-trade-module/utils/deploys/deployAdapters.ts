import { BigNumber, Signer } from "ethers";

import {
  AaveGovernanceV2Adapter,
  AaveV2WrapV2Adapter,
  BalancerV1IndexExchangeAdapter,
  CompoundLikeGovernanceAdapter,
  CurveExchangeAdapter,
  CurveStakingAdapter,
  CurveStEthExchangeAdapter,
  KyberExchangeAdapter,
  KyberV3IndexExchangeAdapter,
  OneInchExchangeAdapter,
  CompoundWrapV2Adapter,
  YearnWrapV2Adapter,
  UniswapPairPriceAdapter,
  UniswapV2AmmAdapter,
  UniswapV2ExchangeAdapter,
  UniswapV2ExchangeAdapterV2,
  UniswapV2IndexExchangeAdapter,
  UniswapV3IndexExchangeAdapter,
  UniswapV2TransferFeeExchangeAdapter,
  UniswapV3ExchangeAdapter,
  UniswapV3ExchangeAdapterV2,
  ZeroExApiAdapter,
  SnapshotGovernanceAdapter,
  SynthetixExchangeAdapter,
  CompoundBravoGovernanceAdapter,
  CompClaimAdapter,
  RgtMigrationWrapAdapter,
} from "../contracts";
import { Address, Bytes } from "./../types";

import { AaveGovernanceV2Adapter__factory } from "../../typechain/factories/AaveGovernanceV2Adapter__factory";
import { AaveV2WrapV2Adapter__factory } from "../../typechain/factories/AaveV2WrapV2Adapter__factory";
import { BalancerV1IndexExchangeAdapter__factory } from "../../typechain/factories/BalancerV1IndexExchangeAdapter__factory";
import { CompoundLikeGovernanceAdapter__factory } from "../../typechain/factories/CompoundLikeGovernanceAdapter__factory";
import { CurveExchangeAdapter__factory } from "../../typechain/factories/CurveExchangeAdapter__factory";
import { CurveStakingAdapter__factory } from "../../typechain/factories/CurveStakingAdapter__factory";
import { CurveStEthExchangeAdapter__factory } from "../../typechain/factories/CurveStEthExchangeAdapter__factory";
import { KyberExchangeAdapter__factory } from "../../typechain/factories/KyberExchangeAdapter__factory";
import { KyberV3IndexExchangeAdapter__factory } from "../../typechain/factories/KyberV3IndexExchangeAdapter__factory";
import { OneInchExchangeAdapter__factory } from "../../typechain/factories/OneInchExchangeAdapter__factory";
import { ZeroExApiAdapter__factory } from "../../typechain/factories/ZeroExApiAdapter__factory";
import { CompoundWrapV2Adapter__factory } from "../../typechain/factories/CompoundWrapV2Adapter__factory";
import { YearnWrapV2Adapter__factory } from "../../typechain/factories/YearnWrapV2Adapter__factory";
import { UniswapPairPriceAdapter__factory } from "../../typechain/factories/UniswapPairPriceAdapter__factory";
import { UniswapV2ExchangeAdapter__factory } from "../../typechain/factories/UniswapV2ExchangeAdapter__factory";
import { UniswapV2AmmAdapter__factory } from "../../typechain/factories/UniswapV2AmmAdapter__factory";
import { UniswapV2TransferFeeExchangeAdapter__factory } from "../../typechain/factories/UniswapV2TransferFeeExchangeAdapter__factory";
import { UniswapV2ExchangeAdapterV2__factory } from "../../typechain/factories/UniswapV2ExchangeAdapterV2__factory";
import { UniswapV2IndexExchangeAdapter__factory } from "../../typechain/factories/UniswapV2IndexExchangeAdapter__factory";
import { UniswapV3IndexExchangeAdapter__factory } from "../../typechain/factories/UniswapV3IndexExchangeAdapter__factory";
import { UniswapV3ExchangeAdapter__factory } from "../../typechain/factories/UniswapV3ExchangeAdapter__factory";
import { UniswapV3ExchangeAdapterV2__factory } from "../../typechain/factories/UniswapV3ExchangeAdapterV2__factory";
import { SnapshotGovernanceAdapter__factory } from "../../typechain/factories/SnapshotGovernanceAdapter__factory";
import { SynthetixExchangeAdapter__factory } from "../../typechain/factories/SynthetixExchangeAdapter__factory";
import { CompoundBravoGovernanceAdapter__factory } from "../../typechain/factories/CompoundBravoGovernanceAdapter__factory";
import { CompClaimAdapter__factory } from "../../typechain";
import { RgtMigrationWrapAdapter__factory } from "../../typechain/factories/RgtMigrationWrapAdapter__factory";

export default class DeployAdapters {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployKyberExchangeAdapter(
    kyberNetworkProxy: Address,
  ): Promise<KyberExchangeAdapter> {
    return await new KyberExchangeAdapter__factory(this._deployerSigner).deploy(kyberNetworkProxy);
  }

  public async deployOneInchExchangeAdapter(
    approveAddress: Address,
    exchangeAddress: Address,
    swapFunctionSignature: Bytes,
  ): Promise<OneInchExchangeAdapter> {
    return await new OneInchExchangeAdapter__factory(this._deployerSigner).deploy(
      approveAddress,
      exchangeAddress,
      swapFunctionSignature,
    );
  }

  public async deployUniswapV2AmmAdapter(uniswapV2Router: Address): Promise<UniswapV2AmmAdapter> {
    return await new UniswapV2AmmAdapter__factory(this._deployerSigner).deploy(uniswapV2Router);
  }

  public async deployUniswapV2ExchangeAdapter(
    uniswapV2Router: Address,
  ): Promise<UniswapV2ExchangeAdapter> {
    return await new UniswapV2ExchangeAdapter__factory(this._deployerSigner).deploy(
      uniswapV2Router,
    );
  }

  public async deployUniswapV2TransferFeeExchangeAdapter(
    uniswapV2Router: Address,
  ): Promise<UniswapV2TransferFeeExchangeAdapter> {
    return await new UniswapV2TransferFeeExchangeAdapter__factory(this._deployerSigner).deploy(
      uniswapV2Router,
    );
  }

  public async deployUniswapV2ExchangeAdapterV2(
    uniswapV2Router: Address,
  ): Promise<UniswapV2ExchangeAdapterV2> {
    return await new UniswapV2ExchangeAdapterV2__factory(this._deployerSigner).deploy(
      uniswapV2Router,
    );
  }

  public async deployUniswapV2IndexExchangeAdapter(
    uniswapV2Router: Address,
  ): Promise<UniswapV2IndexExchangeAdapter> {
    return await new UniswapV2IndexExchangeAdapter__factory(this._deployerSigner).deploy(
      uniswapV2Router,
    );
  }

  public async deployAaveGovernanceV2Adapter(
    aaveGovernanceV2: Address,
    aaveToken: Address,
  ): Promise<AaveGovernanceV2Adapter> {
    return await new AaveGovernanceV2Adapter__factory(this._deployerSigner).deploy(
      aaveGovernanceV2,
      aaveToken,
    );
  }

  public async deployCompClaimAdapter(comptrollerAddress: Address): Promise<CompClaimAdapter> {
    return await new CompClaimAdapter__factory(this._deployerSigner).deploy(comptrollerAddress);
  }

  public async deployBalancerV1IndexExchangeAdapter(
    balancerProxy: Address,
  ): Promise<BalancerV1IndexExchangeAdapter> {
    return await new BalancerV1IndexExchangeAdapter__factory(this._deployerSigner).deploy(
      balancerProxy,
    );
  }

  public async deployCompoundLikeGovernanceAdapter(
    governanceAlpha: Address,
    governanceToken: Address,
  ): Promise<CompoundLikeGovernanceAdapter> {
    return await new CompoundLikeGovernanceAdapter__factory(this._deployerSigner).deploy(
      governanceAlpha,
      governanceToken,
    );
  }

  public async deployCompoundBravoGovernanceAdapter(
    governorBravo: Address,
    governanceToken: Address,
  ): Promise<CompoundBravoGovernanceAdapter> {
    return await new CompoundBravoGovernanceAdapter__factory(this._deployerSigner).deploy(
      governorBravo,
      governanceToken,
    );
  }

  public async deployCurveStakingAdapter(gaugeController: Address): Promise<CurveStakingAdapter> {
    return await new CurveStakingAdapter__factory(this._deployerSigner).deploy(gaugeController);
  }

  public async deployRgtMigrationWrapAdapter(
    pegExchanger: Address,
  ): Promise<RgtMigrationWrapAdapter> {
    return await new RgtMigrationWrapAdapter__factory(this._deployerSigner).deploy(pegExchanger);
  }

  public async deployUniswapPairPriceAdapter(
    controller: Address,
    uniswapFactory: Address,
    uniswapPools: Address[],
  ): Promise<UniswapPairPriceAdapter> {
    return await new UniswapPairPriceAdapter__factory(this._deployerSigner).deploy(
      controller,
      uniswapFactory,
      uniswapPools,
    );
  }

  public async getUniswapPairPriceAdapter(
    uniswapAdapterAddress: Address,
  ): Promise<UniswapPairPriceAdapter> {
    return await new UniswapPairPriceAdapter__factory(this._deployerSigner).attach(
      uniswapAdapterAddress,
    );
  }

  public async deployUniswapV3IndexExchangeAdapter(
    router: Address,
  ): Promise<UniswapV3IndexExchangeAdapter> {
    return await new UniswapV3IndexExchangeAdapter__factory(this._deployerSigner).deploy(router);
  }

  public async deployZeroExApiAdapter(
    zeroExAddress: Address,
    wethAddress: Address,
  ): Promise<ZeroExApiAdapter> {
    return await new ZeroExApiAdapter__factory(this._deployerSigner).deploy(
      zeroExAddress,
      wethAddress,
    );
  }

  public async deploySnapshotGovernanceAdapter(
    delegateRegistry: Address,
  ): Promise<SnapshotGovernanceAdapter> {
    return await new SnapshotGovernanceAdapter__factory(this._deployerSigner).deploy(
      delegateRegistry,
    );
  }

  public async deploySynthetixExchangeAdapter(
    synthetixExchangerAddress: Address,
  ): Promise<SynthetixExchangeAdapter> {
    return await new SynthetixExchangeAdapter__factory(this._deployerSigner).deploy(
      synthetixExchangerAddress,
    );
  }

  public async deployUniswapV3ExchangeAdapter(
    swapRouter: Address,
  ): Promise<UniswapV3ExchangeAdapter> {
    return await new UniswapV3ExchangeAdapter__factory(this._deployerSigner).deploy(swapRouter);
  }

  public async deployUniswapV3ExchangeAdapterV2(
    swapRouter: Address,
  ): Promise<UniswapV3ExchangeAdapterV2> {
    return await new UniswapV3ExchangeAdapterV2__factory(this._deployerSigner).deploy(swapRouter);
  }

  public async deployKyberV3IndexExchangeAdapter(
    dmmRouter: Address,
    dmmFactory: Address,
  ): Promise<KyberV3IndexExchangeAdapter> {
    return await new KyberV3IndexExchangeAdapter__factory(this._deployerSigner).deploy(
      dmmRouter,
      dmmFactory,
    );
  }

  public async deployCompoundWrapV2Adapter(
    libraryName: string,
    libraryAddress: Address,
  ): Promise<CompoundWrapV2Adapter> {
    return await new CompoundWrapV2Adapter__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner,
    ).deploy();
  }

  public async deployYearnWrapV2Adapter(): Promise<YearnWrapV2Adapter> {
    return await new YearnWrapV2Adapter__factory(this._deployerSigner).deploy();
  }

  public async deployAaveV2WrapV2Adapter(lendingPool: Address): Promise<AaveV2WrapV2Adapter> {
    return await new AaveV2WrapV2Adapter__factory(this._deployerSigner).deploy(lendingPool);
  }

  public async deployCurveExchangeAdapter(
    tokenA: Address,
    tokenB: Address,
    tokenAIndex: BigNumber,
    tokenbBIndex: BigNumber,
    exchange: Address,
  ): Promise<CurveExchangeAdapter> {
    return await new CurveExchangeAdapter__factory(this._deployerSigner).deploy(
      tokenA,
      tokenB,
      tokenAIndex,
      tokenbBIndex,
      exchange,
    );
  }

  public async deployCurveStEthExchangeAdapter(
    weth: Address,
    steth: Address,
    exchange: Address,
  ): Promise<CurveStEthExchangeAdapter> {
    return await new CurveStEthExchangeAdapter__factory(this._deployerSigner).deploy(
      weth,
      steth,
      exchange,
    );
  }
}

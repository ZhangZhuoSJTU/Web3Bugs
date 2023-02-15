import { BigNumber, Signer } from "ethers";

import {
  AaveLeverageModule,
  AirdropModule,
  AmmModule,
  BasicIssuanceModule,
  ClaimModule,
  CompoundLeverageModule,
  CustomOracleNavIssuanceModule,
  DebtIssuanceModule,
  DebtIssuanceModuleV2,
  GeneralIndexModule,
  GovernanceModule,
  IssuanceModule,
  NotionalTradeModule,
  PerpV2LeverageModuleV2,
  PerpV2BasisTradingModule,
  SingleIndexModule,
  SlippageIssuanceModule,
  StakingModule,
  StreamingFeeModule,
  TradeModule,
  WrapModule,
  WrapModuleV2
} from "../contracts";
import { Address } from "../types";

import { AaveLeverageModule__factory } from "../../typechain/factories/AaveLeverageModule__factory";
import { AirdropModule__factory } from "../../typechain/factories/AirdropModule__factory";
import { AmmModule__factory } from "../../typechain/factories/AmmModule__factory";
import { BasicIssuanceModule__factory } from "../../typechain/factories/BasicIssuanceModule__factory";
import { ClaimModule__factory } from "../../typechain/factories/ClaimModule__factory";
import { CompoundLeverageModule__factory } from "../../typechain/factories/CompoundLeverageModule__factory";
import { CustomOracleNavIssuanceModule__factory } from "../../typechain/factories/CustomOracleNavIssuanceModule__factory";
import { DebtIssuanceModule__factory } from "../../typechain/factories/DebtIssuanceModule__factory";
import { DebtIssuanceModuleV2__factory } from "../../typechain/factories/DebtIssuanceModuleV2__factory";
import { SlippageIssuanceModule__factory } from "../../typechain/factories/SlippageIssuanceModule__factory";
import { GeneralIndexModule__factory } from "../../typechain/factories/GeneralIndexModule__factory";
import { GovernanceModule__factory } from "../../typechain/factories/GovernanceModule__factory";
import { IssuanceModule__factory } from "../../typechain/factories/IssuanceModule__factory";
import { NotionalTradeModule__factory } from "../../typechain/factories/NotionalTradeModule__factory";
import { PerpV2LeverageModuleV2__factory } from "../../typechain/factories/PerpV2LeverageModuleV2__factory";
import { PerpV2BasisTradingModule__factory } from "../../typechain/factories/PerpV2BasisTradingModule__factory";
import { SingleIndexModule__factory } from "../../typechain/factories/SingleIndexModule__factory";
import { StakingModule__factory } from "../../typechain/factories/StakingModule__factory";
import { StreamingFeeModule__factory } from "../../typechain/factories/StreamingFeeModule__factory";
import { TradeModule__factory } from "../../typechain/factories/TradeModule__factory";
import { WrapModule__factory } from "../../typechain/factories/WrapModule__factory";
import { WrapModuleV2__factory } from "../../typechain/factories/WrapModuleV2__factory";

export default class DeployModules {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployBasicIssuanceModule(controller: Address): Promise<BasicIssuanceModule> {
    return await new BasicIssuanceModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployIssuanceModule(controller: Address): Promise<IssuanceModule> {
    return await new IssuanceModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployDebtIssuanceModule(controller: Address): Promise<DebtIssuanceModule> {
    return await new DebtIssuanceModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployDebtIssuanceModuleV2(controller: Address): Promise<DebtIssuanceModuleV2> {
    return await new DebtIssuanceModuleV2__factory(this._deployerSigner).deploy(controller);
  }

  public async deploySlippageIssuanceModule(controller: Address): Promise<SlippageIssuanceModule> {
    return await new SlippageIssuanceModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployAmmModule(controller: Address): Promise<AmmModule> {
    return await new AmmModule__factory(this._deployerSigner).deploy(controller);
  }

  public async getBasicIssuanceModule(basicIssuanceModule: Address): Promise<BasicIssuanceModule> {
    return await new BasicIssuanceModule__factory(this._deployerSigner).attach(basicIssuanceModule);
  }

  public async deployStreamingFeeModule(controller: Address): Promise<StreamingFeeModule> {
    return await new StreamingFeeModule__factory(this._deployerSigner).deploy(controller);
  }

  public async getStreamingFeeModule(streamingFeeModule: Address): Promise<StreamingFeeModule> {
    return await new StreamingFeeModule__factory(this._deployerSigner).attach(streamingFeeModule);
  }

  public async deployAirdropModule(controller: Address): Promise<AirdropModule> {
    return await new AirdropModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployTradeModule(controller: Address): Promise<TradeModule> {
    return await new TradeModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployWrapModule(controller: Address, weth: Address): Promise<WrapModule> {
    return await new WrapModule__factory(this._deployerSigner).deploy(controller, weth);
  }

  public async deployClaimModule(controller: Address): Promise<ClaimModule> {
    return await new ClaimModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployStakingModule(controller: Address): Promise<StakingModule> {
    return await new StakingModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployCustomOracleNavIssuanceModule(controller: Address, weth: Address): Promise<CustomOracleNavIssuanceModule> {
    return await new CustomOracleNavIssuanceModule__factory(this._deployerSigner).deploy(controller, weth);
  }

  public async deploySingleIndexModule(
    controller: Address,
    weth: Address,
    uniswapRouter: Address,
    sushiswapRouter: Address,
    balancerProxy: Address
  ): Promise<SingleIndexModule> {
    return await new SingleIndexModule__factory(this._deployerSigner).deploy(
      controller,
      weth,
      uniswapRouter,
      sushiswapRouter,
      balancerProxy,
    );
  }

  public async deployGeneralIndexModule(
    controller: Address,
    weth: Address
  ): Promise<GeneralIndexModule> {
    return await new GeneralIndexModule__factory(this._deployerSigner).deploy(
      controller,
      weth
    );
  }

  public async deployGovernanceModule(controller: Address): Promise<GovernanceModule> {
    return await new GovernanceModule__factory(this._deployerSigner).deploy(controller);
  }

  public async deployCompoundLeverageModule(
    controller: Address,
    compToken: Address,
    comptroller: Address,
    cEth: Address,
    weth: Address,
    libraryName: string,
    libraryAddress: Address,
  ): Promise<CompoundLeverageModule> {
    return await new CompoundLeverageModule__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner,
    ).deploy(controller, compToken, comptroller, cEth, weth);
  }

  public async deployAaveLeverageModule(
    controller: Address,
    lendingPoolAddressesProvider: Address,
    libraryName: string,
    libraryAddress: Address,
  ): Promise<AaveLeverageModule> {
    return await new AaveLeverageModule__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner,
    ).deploy(controller, lendingPoolAddressesProvider);
  }

  public async deployNotionalTradeModule(controller: Address, wrappedfCashFactory: Address, weth: Address): Promise<NotionalTradeModule> {
    return await new NotionalTradeModule__factory(this._deployerSigner).deploy(controller, wrappedfCashFactory, weth);
  }

  public async deployWrapModuleV2(controller: Address, weth: Address): Promise<WrapModuleV2> {
    return await new WrapModuleV2__factory(this._deployerSigner).deploy(controller, weth);
  }

  public async deployPerpV2LeverageModuleV2(
    controller: Address,
    perpVault: Address,
    perpQuoter: Address,
    perpMarketRegistry: Address,
    maxPerpPositionsPerSet: BigNumber,
    positionV2LibraryName: string,
    positionV2LibraryAddress: Address,
    perpV2LibraryName: string,
    perpV2LibraryAddress: Address,
    perpV2PositionsLibraryName: string,
    perpV2PositionsLibraryAddress: Address
  ): Promise<PerpV2LeverageModuleV2> {
    return await new PerpV2LeverageModuleV2__factory(
      // @ts-ignore
      {
        [positionV2LibraryName]: positionV2LibraryAddress,
        [perpV2LibraryName]: perpV2LibraryAddress,
        [perpV2PositionsLibraryName]: perpV2PositionsLibraryAddress,
      },
      this._deployerSigner
    ).deploy(
      controller,
      perpVault,
      perpQuoter,
      perpMarketRegistry,
      maxPerpPositionsPerSet
    );
  }

  public async deployPerpV2BasisTradingModule(
    controller: Address,
    perpVault: Address,
    perpQuoter: Address,
    perpMarketRegistry: Address,
    maxPerpPositionsPerSet: BigNumber,
    positionV2LibraryName: string,
    positionV2LibraryAddress: Address,
    perpV2LibraryName: string,
    perpV2LibraryAddress: Address,
    perpV2PositionsLibraryName: string,
    perpV2PositionsLibraryAddress: Address
  ): Promise<PerpV2BasisTradingModule> {
    return await new PerpV2BasisTradingModule__factory(
      // @ts-ignore
      {
        [positionV2LibraryName]: positionV2LibraryAddress,
        [perpV2LibraryName]: perpV2LibraryAddress,
        [perpV2PositionsLibraryName]: perpV2PositionsLibraryAddress,
      },
      this._deployerSigner
    ).deploy(
      controller,
      perpVault,
      perpQuoter,
      perpMarketRegistry,
      maxPerpPositionsPerSet
    );
  }
}

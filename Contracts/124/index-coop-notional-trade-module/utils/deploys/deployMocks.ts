import { Address, Bytes } from "../types";
import { BigNumberish, BigNumber, Signer } from "ethers";

import {
  AaveLendingPoolCoreMock,
  AaveLendingPoolMock,
  AddressArrayUtilsMock,
  AmmAdapterMock,
  BytesArrayUtilsMock,
  ChainlinkAggregatorMock,
  ClaimAdapterMock,
  ContractCallerMock,
  CompoundMock,
  ComptrollerMock,
  CurveStableswapMock,
  CustomSetValuerMock,
  DebtIssuanceMock,
  DebtModuleMock,
  ExplicitERC20Mock,
  ForceFunderMock,
  GaugeControllerMock,
  GodModeMock,
  GovernanceAdapterMock,
  InvokeMock,
  KyberNetworkProxyMock,
  ManagerIssuanceHookMock,
  ModuleIssuanceHookMock,
  ModuleBaseMock,
  ModuleBaseV2Mock,
  NAVIssuanceCaller,
  NAVIssuanceHookMock,
  OneInchExchangeMock,
  OracleAdapterMock,
  OracleMock,
  YearnVaultMock,
  PerpV2Mock,
  PerpV2LibraryV2Mock,
  PerpV2PositionsMock,
  PositionMock,
  PositionV2Mock,
  PreciseUnitMathMock,
  ResourceIdentifierMock,
  StakingAdapterMock,
  StandardTokenMock,
  StandardTokenWithRoundingErrorMock,
  StandardTokenWithFeeMock,
  TradeAdapterMock,
  StringArrayUtilsMock,
  SynthMock,
  SynthetixExchangerMock,
  TribePegExchangerMock,
  Uint256ArrayUtilsMock,
  WrapAdapterMock,
  WrapV2AdapterMock,
  ZeroExMock,
  YearnStrategyMock,
  AaveV2Mock,
  UniswapV3MathMock,
  UnitConversionUtilsMock,
  SetTokenAccessibleMock,
  WrappedfCashMock,
  WrappedfCashFactoryMock,
} from "../contracts";

import { ether } from "../common";
import dependencies from "./dependencies";

import { AaveLendingPoolCoreMock__factory } from "../../typechain/factories/AaveLendingPoolCoreMock__factory";
import { AaveLendingPoolMock__factory } from "../../typechain/factories/AaveLendingPoolMock__factory";
import { AddressArrayUtilsMock__factory } from "../../typechain/factories/AddressArrayUtilsMock__factory";
import { AmmAdapterMock__factory } from "../../typechain/factories/AmmAdapterMock__factory";
import { BytesArrayUtilsMock__factory } from "../../typechain/factories/BytesArrayUtilsMock__factory";
import { ChainlinkAggregatorMock__factory } from "../../typechain/factories/ChainlinkAggregatorMock__factory";
import { ClaimAdapterMock__factory } from "../../typechain/factories/ClaimAdapterMock__factory";
import { CompoundMock__factory } from "../../typechain/factories/CompoundMock__factory";
import { ComptrollerMock__factory } from "../../typechain/factories/ComptrollerMock__factory";
import { ContractCallerMock__factory } from "../../typechain/factories/ContractCallerMock__factory";
import { CurveStableswapMock__factory } from "../../typechain/factories/CurveStableswapMock__factory";
import { CustomSetValuerMock__factory } from "../../typechain/factories/CustomSetValuerMock__factory";
import { DebtIssuanceMock__factory } from "../../typechain/factories/DebtIssuanceMock__factory";
import { DebtModuleMock__factory } from "../../typechain/factories/DebtModuleMock__factory";
import { ExplicitERC20Mock__factory } from "../../typechain/factories/ExplicitERC20Mock__factory";
import { ForceFunderMock__factory } from "../../typechain/factories/ForceFunderMock__factory";
import { GaugeControllerMock__factory } from "../../typechain/factories/GaugeControllerMock__factory";
import { GodModeMock__factory } from "../../typechain/factories/GodModeMock__factory";
import { GovernanceAdapterMock__factory } from "../../typechain/factories/GovernanceAdapterMock__factory";
import { InvokeMock__factory } from "../../typechain/factories/InvokeMock__factory";
import { KyberNetworkProxyMock__factory } from "../../typechain/factories/KyberNetworkProxyMock__factory";
import { ManagerIssuanceHookMock__factory } from "../../typechain/factories/ManagerIssuanceHookMock__factory";
import { ModuleBaseMock__factory } from "../../typechain/factories/ModuleBaseMock__factory";
import { ModuleBaseV2Mock__factory } from "../../typechain/factories/ModuleBaseV2Mock__factory";
import { ModuleIssuanceHookMock__factory } from "../../typechain/factories/ModuleIssuanceHookMock__factory";
import { NAVIssuanceCaller__factory } from "../../typechain/factories/NAVIssuanceCaller__factory";
import { NAVIssuanceHookMock__factory } from "../../typechain/factories/NAVIssuanceHookMock__factory";
import { OneInchExchangeMock__factory } from "../../typechain/factories/OneInchExchangeMock__factory";
import { OracleAdapterMock__factory } from "../../typechain/factories/OracleAdapterMock__factory";
import { OracleMock__factory } from "../../typechain/factories/OracleMock__factory";
import { YearnVaultMock__factory } from "../../typechain/factories/YearnVaultMock__factory";
import { PerpV2Mock__factory } from "../../typechain/factories/PerpV2Mock__factory";
import { PerpV2LibraryV2Mock__factory } from "../../typechain/factories/PerpV2LibraryV2Mock__factory";
import { PerpV2PositionsMock__factory } from "../../typechain/factories/PerpV2PositionsMock__factory";
import { PositionMock__factory } from "../../typechain/factories/PositionMock__factory";
import { PositionV2Mock__factory } from "../../typechain/factories/PositionV2Mock__factory";
import { PreciseUnitMathMock__factory } from "../../typechain/factories/PreciseUnitMathMock__factory";
import { ResourceIdentifierMock__factory } from "../../typechain/factories/ResourceIdentifierMock__factory";
import { StakingAdapterMock__factory } from "../../typechain/factories/StakingAdapterMock__factory";
import { StandardTokenMock__factory } from "../../typechain/factories/StandardTokenMock__factory";
import { StandardTokenWithRoundingErrorMock__factory } from "../../typechain/factories/StandardTokenWithRoundingErrorMock__factory";
import { StandardTokenWithFeeMock__factory } from "../../typechain/factories/StandardTokenWithFeeMock__factory";
import { TribePegExchangerMock__factory } from "../../typechain/factories/TribePegExchangerMock__factory";
import { TradeAdapterMock__factory } from "../../typechain/factories/TradeAdapterMock__factory";
import { Uint256ArrayUtilsMock__factory } from "../../typechain/factories/Uint256ArrayUtilsMock__factory";
import { WrapAdapterMock__factory } from "../../typechain/factories/WrapAdapterMock__factory";
import { WrapV2AdapterMock__factory } from "../../typechain/factories/WrapV2AdapterMock__factory";
import { ZeroExMock__factory } from "../../typechain/factories/ZeroExMock__factory";
import { StringArrayUtilsMock__factory  } from "../../typechain/factories/StringArrayUtilsMock__factory";
import { SynthMock__factory } from "../../typechain/factories/SynthMock__factory";
import { SynthetixExchangerMock__factory } from "../../typechain/factories/SynthetixExchangerMock__factory";
import { YearnStrategyMock__factory } from "../../typechain/factories/YearnStrategyMock__factory";
import { AaveV2Mock__factory } from "../../typechain/factories/AaveV2Mock__factory";
import { UniswapV3MathMock__factory } from "../../typechain/factories/UniswapV3MathMock__factory";
import { UnitConversionUtilsMock__factory } from "../../typechain/factories/UnitConversionUtilsMock__factory";
import { SetTokenAccessibleMock__factory } from "../../typechain/factories/SetTokenAccessibleMock__factory";
import { WrappedfCashMock__factory } from "../../typechain/factories/WrappedfCashMock__factory";
import { WrappedfCashFactoryMock__factory } from "../../typechain/factories/WrappedfCashFactoryMock__factory";

export default class DeployMocks {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployExplicitErc20Mock(): Promise<ExplicitERC20Mock> {
    return await new ExplicitERC20Mock__factory(this._deployerSigner).deploy();
  }

  public async deployInvokeMock(): Promise<InvokeMock> {
    return await new InvokeMock__factory(this._deployerSigner).deploy();
  }

  public async deployManagerIssuanceHookMock(): Promise<ManagerIssuanceHookMock> {
    return await new ManagerIssuanceHookMock__factory(this._deployerSigner).deploy();
  }

  public async deployModuleIssuanceHookMock(): Promise<ModuleIssuanceHookMock> {
    return await new ModuleIssuanceHookMock__factory(this._deployerSigner).deploy();
  }

  public async deployNavIssuanceHookMock(): Promise<NAVIssuanceHookMock> {
    return await new NAVIssuanceHookMock__factory(this._deployerSigner).deploy();
  }

  public async deployNAVIssuanceCaller(navIssuanceModule: Address): Promise<NAVIssuanceCaller> {
    return await new NAVIssuanceCaller__factory(this._deployerSigner).deploy(navIssuanceModule);
  }

  public async deployAddressArrayUtilsMock(): Promise<AddressArrayUtilsMock> {
    return await new AddressArrayUtilsMock__factory(this._deployerSigner).deploy();
  }

  public async deployUint256ArrayUtilsMock(): Promise<Uint256ArrayUtilsMock> {
    return await new Uint256ArrayUtilsMock__factory(this._deployerSigner).deploy();
  }

  public async deployKyberNetworkProxyMock(mockWethAddress: Address): Promise<KyberNetworkProxyMock> {
    return await new KyberNetworkProxyMock__factory(this._deployerSigner).deploy(mockWethAddress);
  }

  public async deployModuleBaseMock(controllerAddress: Address): Promise<ModuleBaseMock> {
    return await new ModuleBaseMock__factory(this._deployerSigner).deploy(controllerAddress);
  }

  public async deployModuleBaseV2Mock(controllerAddress: Address): Promise<ModuleBaseV2Mock> {
    return await new ModuleBaseV2Mock__factory(this._deployerSigner).deploy(controllerAddress);
  }

  public async deployGodModeMock(controllerAddress: Address): Promise<GodModeMock> {
    return await new GodModeMock__factory(this._deployerSigner).deploy(controllerAddress);
  }

  public async deployDebtModuleMock(controllerAddress: Address): Promise<DebtModuleMock> {
    return await new DebtModuleMock__factory(this._deployerSigner).deploy(controllerAddress);
  }

  public async deployGovernanceAdapterMock(initialProposalId: BigNumberish): Promise<GovernanceAdapterMock> {
    return await new GovernanceAdapterMock__factory(this._deployerSigner).deploy(initialProposalId);
  }

  public async deployCurveStableswapMock(coins: Address[]): Promise<CurveStableswapMock> {
    return await new CurveStableswapMock__factory(this._deployerSigner).deploy(coins);
  }

  public async deployOneInchExchangeMock(
    sendToken: Address,
    receiveToken: Address,
    sendQuantity: BigNumber,
    receiveQuantity: BigNumber,
  ): Promise<OneInchExchangeMock> {
    return await new OneInchExchangeMock__factory(this._deployerSigner).deploy(
      sendToken,
      receiveToken,
      sendQuantity,
      receiveQuantity,
    );
  }

  public async deployZeroExMock(
    sendToken: Address,
    receiveToken: Address,
    sendQuantity: BigNumber,
    receiveQuantity: BigNumber,
  ): Promise<ZeroExMock> {
    return await new ZeroExMock__factory(this._deployerSigner).deploy(
      sendToken,
      receiveToken,
      sendQuantity,
      receiveQuantity,
    );
  }

  public async deployOracleMock(initialValue: BigNumberish): Promise<OracleMock> {
    return await new OracleMock__factory(this._deployerSigner).deploy(initialValue);
  }

  public async deployYearnVaultMock(pricePerShare: BigNumberish): Promise<YearnVaultMock> {
    return await new YearnVaultMock__factory(this._deployerSigner).deploy(pricePerShare);
  }

  public async deployOracleAdapterMock(
    asset: Address,
    dummyPrice: BigNumber
  ): Promise<OracleAdapterMock> {
    return await new OracleAdapterMock__factory(this._deployerSigner).deploy(asset, dummyPrice);
  }

  public async deployPositionMock(): Promise<PositionMock> {
    return await new PositionMock__factory(this._deployerSigner).deploy();
  }

  public async deployPositionV2Mock(libraryName: string, libraryAddress: Address): Promise<PositionV2Mock> {
    return await new PositionV2Mock__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner
    ).deploy();
  }

  public async deployPreciseUnitMathMock(): Promise<PreciseUnitMathMock> {
    return await new PreciseUnitMathMock__factory(this._deployerSigner).deploy();
  }

  public async deployResourceIdentifierMock(): Promise<ResourceIdentifierMock> {
    return await new ResourceIdentifierMock__factory(this._deployerSigner).deploy();
  }

  public async deployStakingAdapterMock(stakingAsset: Address): Promise<StakingAdapterMock> {
    return await new StakingAdapterMock__factory(this._deployerSigner)
      .deploy(stakingAsset);
  }

  public async deployTokenMock(
    initialAccount: Address,
    initialBalance: BigNumberish = ether(1000000000),
    decimals: BigNumberish = 18,
    name: string = "Token",
    symbol: string = "Symbol"
  ): Promise<StandardTokenMock> {
    return await new StandardTokenMock__factory(this._deployerSigner)
      .deploy(initialAccount, initialBalance, name, symbol, decimals);
  }

  public async deployTokenWithFeeMock(
    initialAccount: Address,
    initialBalance: BigNumberish = ether(1000000000),
    fee: BigNumberish = ether(0.1),
    name: string = "Token",
    symbol: string = "Symbol"
  ): Promise<StandardTokenWithFeeMock> {
    return await new StandardTokenWithFeeMock__factory(this._deployerSigner)
      .deploy(initialAccount, initialBalance, name, symbol, fee);
  }

  public async deployTokenWithErrorMock(
    initialAccount: Address,
    initialBalance: BigNumberish,
    error: BigNumberish,
    name: string = "Token",
    symbol: string = "Symbol",
    decimals: BigNumberish = BigNumber.from(18)
  ): Promise<StandardTokenWithRoundingErrorMock> {
    return await new StandardTokenWithRoundingErrorMock__factory(this._deployerSigner).deploy(
      initialAccount, initialBalance, error, name, symbol, decimals
    );
  }

  public async deployTradeAdapterMock(): Promise<TradeAdapterMock> {
    return await new TradeAdapterMock__factory(this._deployerSigner).deploy();
  }

  public async deployAmmAdapterMock(_underlyingTokens: Address[]): Promise<AmmAdapterMock> {
    return await new AmmAdapterMock__factory(this._deployerSigner).deploy(_underlyingTokens);
  }

  public async deployWrapAdapterMock(): Promise<WrapAdapterMock> {
    return await new WrapAdapterMock__factory(this._deployerSigner).deploy();
  }

  public async deployAaveLendingPoolCoreMock(): Promise<AaveLendingPoolCoreMock> {
    return await new AaveLendingPoolCoreMock__factory(this._deployerSigner).deploy();
  }

  public async deployAaveLendingPoolMock(aaveLendingPoolCore: Address): Promise<AaveLendingPoolMock> {
    return await new AaveLendingPoolMock__factory(this._deployerSigner).deploy(aaveLendingPoolCore);
  }

  public async deployAaveV2Mock(libraryName: string, libraryAddress: Address): Promise<AaveV2Mock> {
    return await new AaveV2Mock__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner
    ).deploy();
  }

  public async deployPerpV2Mock(libraryName: string, libraryAddress: Address): Promise<PerpV2Mock> {
    return await new PerpV2Mock__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner
    ).deploy();
  }

  public async deployPerpV2LibraryV2Mock(libraryName: string, libraryAddress: Address): Promise<PerpV2LibraryV2Mock> {
    return await new PerpV2LibraryV2Mock__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner
    ).deploy();
  }

  public async deployPerpV2PositionsMock(
    libraryName: string,
    libraryAddress: Address
  ): Promise<PerpV2PositionsMock> {
    return await new PerpV2PositionsMock__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner
    ).deploy();
  }

  public async deployUniswapV3MathMock(): Promise<UniswapV3MathMock> {
    return await new UniswapV3MathMock__factory(this._deployerSigner).deploy();
  }

  public async deployUnitConversionUtilsMock(): Promise<UnitConversionUtilsMock> {
    return await new UnitConversionUtilsMock__factory(this._deployerSigner).deploy();
  }

  public async deploySetTokenAccessibleMock(controller: Address): Promise<SetTokenAccessibleMock> {
    return await new SetTokenAccessibleMock__factory(this._deployerSigner).deploy(controller);
  }

  public async deployClaimAdapterMock(): Promise<ClaimAdapterMock> {
    return await new ClaimAdapterMock__factory(this._deployerSigner).deploy();
  }

  public async deployGaugeControllerMock(): Promise<GaugeControllerMock> {
    return await new GaugeControllerMock__factory(this._deployerSigner).deploy();
  }

  public async deployContractCallerMock(): Promise<ContractCallerMock> {
    return await new ContractCallerMock__factory(this._deployerSigner).deploy();
  }

  public async deployDebtIssuanceMock(): Promise<DebtIssuanceMock> {
    return await new DebtIssuanceMock__factory(this._deployerSigner).deploy();
  }

  public async deployComptrollerMock(
    comp: Address,
    compAmount: BigNumber,
    cToken: Address
  ): Promise<ComptrollerMock> {
    return await new ComptrollerMock__factory(this._deployerSigner).deploy(
      comp,
      compAmount,
      cToken
    );
  }

  public async deployCompoundMock(libraryName: string, libraryAddress: Address): Promise<CompoundMock> {
    return await new CompoundMock__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner
    ).deploy();
  }

  public async deploySynthMock(
    initialAccount: Address,
    currencyKey: Bytes,
    initialBalance: BigNumberish = ether(1000000000),
    name: string = "Token",
    symbol: string = "Symbol",
  ): Promise<SynthMock> {
    return await new SynthMock__factory(this._deployerSigner)
      .deploy(initialAccount, initialBalance, name, symbol, 18, currencyKey);
  }

  public async deploySynthetixExchangerMock(
    sUsd: Address,
    sEth: Address,
    sBtc: Address,
    currencyKeys: any,
    rates: any
  ): Promise<SynthetixExchangerMock> {
    return await new SynthetixExchangerMock__factory(this._deployerSigner).deploy(
      sUsd,
      sEth,
      sBtc,
      currencyKeys.sUsd,
      currencyKeys.sEth,
      currencyKeys.sBtc,
      rates.usd.eth,
      rates.eth.usd,
      rates.usd.btc,
      rates.btc.usd
    );
  }

  public async deployCustomSetValuerMock(): Promise<CustomSetValuerMock> {
    return await new CustomSetValuerMock__factory(this._deployerSigner).deploy();
  }

  public async deployYearnStrategyMock(vault: Address): Promise<YearnStrategyMock> {
    return await new YearnStrategyMock__factory(this._deployerSigner).deploy(vault);
  }

  public async deployForceFunderMock(): Promise<ForceFunderMock> {
    return await new ForceFunderMock__factory(this._deployerSigner).deploy();
  }

  public async deployWrapV2AdapterMock(): Promise<WrapV2AdapterMock> {
    return await new WrapV2AdapterMock__factory(this._deployerSigner).deploy();
  }

  public async deployChainlinkAggregatorMock(decimals: number): Promise<ChainlinkAggregatorMock> {
    return await new ChainlinkAggregatorMock__factory(this._deployerSigner).deploy(decimals);
  }

  public async deployTribePegExchangerMock(rgt: Address, tribe: Address): Promise<TribePegExchangerMock> {
    return await new TribePegExchangerMock__factory(this._deployerSigner).deploy(rgt, tribe);
  }

  public async deployStringArrayUtilsMock(): Promise<StringArrayUtilsMock> {
    return await new StringArrayUtilsMock__factory(this._deployerSigner).deploy();
  }

  public async deployBytesArrayUtilsMock(): Promise<BytesArrayUtilsMock> {
    return await new BytesArrayUtilsMock__factory(this._deployerSigner).deploy();
  }

  public async deployWrappedfCashMock(assetToken: Address, underlyingToken: Address, weth: Address): Promise<WrappedfCashMock> {
    return await new WrappedfCashMock__factory(this._deployerSigner).deploy(assetToken, underlyingToken, weth);
  }

  public async deployWrappedfCashFactoryMock(): Promise<WrappedfCashFactoryMock> {
    return await new WrappedfCashFactoryMock__factory(this._deployerSigner).deploy();
  }
  /** ***********************************
   * Instance getters
   ************************************/

  public async getTokenMock(token: Address): Promise<StandardTokenMock> {
    return await new StandardTokenMock__factory(this._deployerSigner).attach(token);
  }

  public async getForkedZeroExExchange(): Promise<ZeroExMock> {
    return await ZeroExMock__factory.connect(dependencies.ZERO_EX_EXCHANGE[1], this._deployerSigner);
  }
}

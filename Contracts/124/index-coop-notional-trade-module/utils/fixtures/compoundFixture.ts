import { BigNumberish, BigNumber, providers, Signer } from "ethers";

import {
  CERc20,
  CEther,
  Comp,
  CompoundGovernorAlpha,
  CompoundTimelock,
  CompoundPriceOracleMock,
  Comptroller,
  PriceOracleProxy,
  Unitroller,
  WhitePaperInterestRateModel,
  CompoundGovernorBravoDelegate,
  CompoundGovernorBravoDelegator,
} from "../contracts/compound";
import DeployHelper from "../deploys";
import {
  ether,
} from "../common";
import {
  Address,
} from "../types";
import {
  ADDRESS_ZERO,
  ONE_DAY_IN_SECONDS,
  ZERO,
  ZERO_BYTES
} from "../constants";
import { getLastBlockTimestamp, increaseTimeAsync } from "../test";

export class CompoundFixture {
  private _deployer: DeployHelper;
  private _ownerAddress: Address;
  private _ownerSigner: Signer;

  public unitroller: Unitroller;
  public comp: Comp;
  public compoundTimelock: CompoundTimelock;
  public compoundGovernorAlpha: CompoundGovernorAlpha;
  public compoundGovernorBravoDelegate: CompoundGovernorBravoDelegate;
  public compoundGovernorBravoDelegator: CompoundGovernorBravoDelegator;
  public comptroller: Comptroller;
  public interestRateModel: WhitePaperInterestRateModel;

  public priceOracle: CompoundPriceOracleMock;
  public priceOracleProxy: PriceOracleProxy;

  constructor(provider: providers.Web3Provider | providers.JsonRpcProvider, ownerAddress: Address) {
    this._ownerAddress = ownerAddress;
    this._ownerSigner = provider.getSigner(ownerAddress);
    this._deployer = new DeployHelper(this._ownerSigner);
  }

  public async initialize(): Promise<void> {
    this.priceOracle = await this._deployer.external.deployCompoundPriceOracleMock();

    // TODO - can fill with real addresses
    this.priceOracleProxy = await this._deployer.external.deployPriceOracleProxy(
      ADDRESS_ZERO,
      this.priceOracle.address,
      ADDRESS_ZERO,
      ADDRESS_ZERO,
      ADDRESS_ZERO,
      ADDRESS_ZERO,
      ADDRESS_ZERO,
    );

    this.unitroller = await this._deployer.external.deployUnitroller();
    this.comptroller = await this._deployer.external.deployComptroller();
    await this.unitroller._setPendingImplementation(this.comptroller.address);
    await this.comptroller._become(this.unitroller.address, ZERO, [], []);
    await this.comptroller._setPriceOracle(this.priceOracle.address);
    await this.comptroller._setMaxAssets(10);
    await this.comptroller._setCloseFactor(ether(0.5));
    await this.comptroller._setLiquidationIncentive(ether(1.08));

    // deploy Interest rate model
    this.interestRateModel = await this._deployer.external.deployWhitePaperInterestRateModel(
      ether(1), // To change
      ether(1), // To change
    );

    // Deploy COMP governance
    this.comp = await this._deployer.external.deployComp(this._ownerAddress);
    await this.comp.transfer(this.comptroller.address, ether(400000));

    this.compoundTimelock = await this._deployer.external.deployCompoundTimelock(
      this._ownerAddress,
      ONE_DAY_IN_SECONDS.mul(2),
    );
    this.compoundGovernorAlpha = await this._deployer.external.deployCompoundGovernorAlpha(
      this.compoundTimelock.address,
      this.comp.address,
      this._ownerAddress
    );
  }

  public async initializeGovernorBravo() {
    this.compoundGovernorBravoDelegate = await this._deployer.external.deployCompoundGovernorBravoDelegate();
    this.compoundGovernorBravoDelegator = await this._deployer.external.deployCompoundGovernorBravoDelegator(
      this.compoundTimelock.address,
      this.comp.address,
      this._ownerAddress,
      this.compoundGovernorBravoDelegate.address,
      10000,
      1,
      ether(100_000)
    );

    const setAdminData = this.compoundTimelock.interface.encodeFunctionData("setPendingAdmin", [this.compoundGovernorBravoDelegator.address]);
    const eta = (await getLastBlockTimestamp()).add(ONE_DAY_IN_SECONDS.mul(2)).add(1);
    await this.compoundTimelock.queueTransaction(this.compoundTimelock.address, 0, "", setAdminData, eta);
    await increaseTimeAsync(ONE_DAY_IN_SECONDS.mul(2).add(2));
    await this.compoundTimelock.executeTransaction(this.compoundTimelock.address, 0, "", setAdminData, eta);

    await this.comp.delegate(this._ownerAddress);
    await this.compoundGovernorAlpha.connect(this._ownerSigner).propose([ADDRESS_ZERO], [0], [""], [ZERO_BYTES], "dummy prop");

    const initiateCallData = this.compoundGovernorBravoDelegate.interface.encodeFunctionData("_initiate", [this.compoundGovernorAlpha.address]);
    await this.compoundGovernorBravoDelegator.fallback({data: initiateCallData});
  }

  public async createAndEnableCToken(
    underlying: Address,
    initialExchangeRateMantissa: BigNumberish,
    comptroller: Address = this.unitroller.address,
    interestRateModel: Address = this.interestRateModel.address,
    name: string = "CToken",
    symbol: string = "CT",
    decimals: BigNumberish = 8,
    collateralFactor: BigNumber,
    currentPrice: BigNumber
  ): Promise<CERc20> {
    const newCToken = await this._deployer.external.deployCeRc20(
      underlying,
      comptroller,
      interestRateModel,
      initialExchangeRateMantissa,
      name,
      symbol,
      decimals,
    );

    await this.comptroller._supportMarket(newCToken.address);
    // Set starting price
    await this.priceOracle.setUnderlyingPrice(newCToken.address, currentPrice);
    // Set starting collateral factor
    await this.comptroller._setCollateralFactor(newCToken.address, collateralFactor);

    return newCToken;
  }

  public async createAndEnableCEther(
    initialExchangeRateMantissa: BigNumberish,
    comptroller: Address = this.unitroller.address,
    interestRateModel: Address = this.interestRateModel.address,
    name: string = "CEther",
    symbol: string = "CETH",
    decimals: BigNumberish = 8,
    collateralFactor: BigNumber,
    currentPrice: BigNumber
  ): Promise<CEther> {
    const newCToken = await this._deployer.external.deployCEther(
      comptroller,
      interestRateModel,
      initialExchangeRateMantissa,
      name,
      symbol,
      decimals,
    );

    await this.comptroller._supportMarket(newCToken.address);
    // Set starting price
    await this.priceOracle.setUnderlyingPrice(newCToken.address, currentPrice);
    // Set starting collateral factor
    await this.comptroller._setCollateralFactor(newCToken.address, collateralFactor);

    return newCToken;
  }
}

import DeployHelper from "../deploys";
import { Signer } from "ethers";
import { Address } from "../types";
import { providers, BigNumber, BigNumberish } from "ethers";

import {
  AaveGovernanceV2,
  AaveTokenV2Mintable,
  AaveV2Oracle,
  AaveV2PriceOracle,
  AaveV2LendingPool,
  AaveV2ProtocolDataProvider,
  AaveV2LendingPoolConfigurator,
  AaveV2LendingPoolAddressesProvider,
  AaveV2LendingPoolCollateralManager,
  AaveV2DefaultReserveInterestRateStrategy,
  AaveV2LendingRateOracle,
  AaveV2AToken,
  AaveV2StableDebtToken,
  AaveV2VariableDebtToken,
  Executor,
  GovernanceStrategy
} from "../contracts/aaveV2";
import { ether, getRandomAddress } from "../common";
import { ADDRESS_ZERO, MAX_UINT_256 } from "../constants";
import dependencies from "../deploys/dependencies";

export interface ReserveTokens {
  aToken: AaveV2AToken;
  stableDebtToken: AaveV2StableDebtToken;
  variableDebtToken: AaveV2VariableDebtToken;
}

export class AaveV2Fixture {
  private _deployer: DeployHelper;
  private _ownerSigner: Signer;

  public wethReserveTokens: ReserveTokens;
  public daiReserveTokens: ReserveTokens;

  public genericLogicLibraryAddress: Address;
  public reserveLogicAddress: Address;
  public validationLogicAddress: Address;

  public marketId: string;
  public lendingPool: AaveV2LendingPool;
  public protocolDataProvider: AaveV2ProtocolDataProvider;
  public lendingPoolConfigurator: AaveV2LendingPoolConfigurator;
  public lendingPoolCollateralManager: AaveV2LendingPoolCollateralManager;
  public lendingPoolAddressesProvider: AaveV2LendingPoolAddressesProvider;
  public reserveInterestRateStrategy: AaveV2DefaultReserveInterestRateStrategy;

  public priceOracle: AaveV2Oracle;
  public fallbackOracle: AaveV2PriceOracle;
  public lendingRateOracle: AaveV2LendingRateOracle;

  public treasuryAddress: Address;
  public incentivesControllerAddress: Address;

  public aaveToken: AaveTokenV2Mintable;
  public stkAaveToken: AaveTokenV2Mintable;

  public aaveGovernanceV2: AaveGovernanceV2;
  public executor: Executor;
  public governanceStrategy: GovernanceStrategy;

  constructor(provider: providers.Web3Provider | providers.JsonRpcProvider, ownerAddress: Address) {
    this._ownerSigner = provider.getSigner(ownerAddress);
    this._deployer = new DeployHelper(this._ownerSigner);
  }

  public async initialize(
    weth: Address,
    dai: Address,
    marketId: string = "Commons",
    daiPriceInEth: BigNumber = ether(0.001)   // 1 DAI = 0.001 ETH
  ): Promise<void> {
    this.marketId = marketId;

    // deploy libraries
    this.genericLogicLibraryAddress = (await this._deployer.external.deployGeneralLogic()).address;
    this.reserveLogicAddress = (await this._deployer.external.deployReserveLogic()).address;
    this.validationLogicAddress = (await this._deployer.external.deployValidationLogic(this.genericLogicLibraryAddress)).address;

    // deploy contracts
    this.lendingPoolConfigurator = await this._deployer.external.deployAaveV2LendingPoolConfigurator();
    this.lendingPoolCollateralManager = await this._deployer.external.deployAaveV2LendingPoolCollateralManager();
    this.lendingPool = await this._deployer.external.deployAaveV2LendingPool(this.validationLogicAddress, this.reserveLogicAddress);
    this.lendingPoolAddressesProvider = await this._deployer.external.deployAaveV2LendingPoolAddressesProvider(this.marketId);
    this.protocolDataProvider = await this._deployer.external.deployAaveV2ProtocolDataProvider(this.lendingPoolAddressesProvider.address);
    this.reserveInterestRateStrategy = await this._deployer.external.deployAaveV2DefaultReserveInterestRateStrategy(
      this.lendingPoolAddressesProvider.address
    );

    // deploy oracles
    this.lendingRateOracle = await this._deployer.external.deployAaveV2LendingRateOracle();
    // Aave V2 oracle relies on Chainlink oracle and their fallback oracle. For fixture, we would be deploying a mock fallback oracle
    // with ability to set asset prices on it, which is comparitively easier than deploying multiple chainlink aggregators.
    this.fallbackOracle = await this._deployer.external.deployAaveV2PriceOracle();
    this.priceOracle = await this._deployer.external.deployAaveV2Oracle([], [], this.fallbackOracle.address, weth);

    // set addresses in LendingPoolAddressProvider
    await this.lendingPoolAddressesProvider.setPriceOracle(this.priceOracle.address);
    await this.lendingPoolAddressesProvider.setLendingRateOracle(this.lendingRateOracle.address);
    await this.lendingPoolAddressesProvider.setPoolAdmin(await this._ownerSigner.getAddress());
    await this.lendingPoolAddressesProvider.setLendingPoolCollateralManager(this.lendingPoolCollateralManager.address);
    // Set the protocol data provider to the 0x1 ID. Use the raw input here vs converting to bytes32 to match Aave configuration
    await this.lendingPoolAddressesProvider.setAddress(
      "0x0100000000000000000000000000000000000000000000000000000000000000",
      this.protocolDataProvider.address
    );

    // LendingPoolAddressProvider creates a new proxy contract and sets the passed in address as the implementation.
    // We then fetch the proxy's address and attach it to the contract object, which allows us to use the contract object
    // to call functions on the proxy
    await this.lendingPoolAddressesProvider.setLendingPoolImpl(this.lendingPool.address);
    const proxyPool = await this.lendingPoolAddressesProvider.getLendingPool();
    this.lendingPool = this.lendingPool.attach(proxyPool);

    await this.lendingPoolAddressesProvider.setLendingPoolConfiguratorImpl(this.lendingPoolConfigurator.address);
    const proxyConfigurator = await this.lendingPoolAddressesProvider.getLendingPoolConfigurator();
    this.lendingPoolConfigurator = this.lendingPoolConfigurator.attach(proxyConfigurator);

    this.treasuryAddress = await getRandomAddress();	// Tokens are minted to the treasury, so it can't be zero address
    this.incentivesControllerAddress = ADDRESS_ZERO;

    // set initial asset prices in ETH
    await this.setAssetPriceInOracle(dai, daiPriceInEth);

    // As per Aave's interest rate model, if U < U_optimal, R_t = R_0 + (U_t/U_optimal) * R_slope1, when U_t = 0, R_t = R_0
    // R_0 is the interest rate when utilization is 0 (it's the intercept for the above linear equation)
    // And for higher precision it is expressed in Rays
    const oneRay = BigNumber.from(10).pow(27);	// 1e27
    // set initial market rates (R_0)
    await this.setMarketBorrowRate(weth, oneRay.mul(3).div(100));
    await this.setMarketBorrowRate(dai, oneRay.mul(39).div(1000));

    // Deploy and configure WETH reserve
    this.wethReserveTokens = await this.createAndEnableReserve(
      weth, "WETH", BigNumber.from(18),
      BigNumber.from(8000),   // base LTV: 80%
      BigNumber.from(8250),   // liquidation threshold: 82.5%
      BigNumber.from(10500),  // liquidation bonus: 105.00%
      BigNumber.from(1000),   // reserve factor: 10%
      true,					          // enable borrowing on reserve
      true					          // enable stable debts
    );

    // Deploy and configure DAI reserve
    this.daiReserveTokens = await this.createAndEnableReserve(
      dai, "DAI", BigNumber.from(18),
      BigNumber.from(7500),   // base LTV: 75%
      BigNumber.from(8000),   // liquidation threshold: 80%
      BigNumber.from(10500),  // liquidation bonus: 105.00%
      BigNumber.from(1000),   // reserve factor: 10%
      true,					          // enable borrowing on reserve
      true					          // enable stable debts
    );

    // Initialize governance
    await this.initializeGovernance();
  }

  public async createAndEnableReserve(
    underlyingAsset: Address,
    underlyingAssetSymbol: string,
    underlyingAssetDecimals: BigNumberish,
    baseLTV: BigNumberish,
    liquidationThreshold: BigNumberish,
    liquidationBonus: BigNumberish,
    reserveFactor: BigNumberish,
    borrowingEnabled: boolean,
    stableBorrowingEnabled: boolean,
    treasuryAddress: Address = this.treasuryAddress,
    incentivesControllerAddress: Address = this.incentivesControllerAddress,
    interestRateStrategyAddress: Address = this.reserveInterestRateStrategy.address
  ): Promise<ReserveTokens> {

    let aToken = await this._deployer.external.deployAaveV2AToken();
    let stableDebtToken = await this._deployer.external.deployAaveV2StableDebtToken();
    let variableDebtToken = await this._deployer.external.deployAaveV2VariableDebtToken();

    // init reserve
    await this.lendingPoolConfigurator.batchInitReserve(
      [
        {
          "aTokenImpl": aToken.address,
          "stableDebtTokenImpl": stableDebtToken.address,
          "variableDebtTokenImpl": variableDebtToken.address,
          "underlyingAssetDecimals": underlyingAssetDecimals,
          "interestRateStrategyAddress": interestRateStrategyAddress,
          "underlyingAsset": underlyingAsset,
          "treasury": treasuryAddress,
          "incentivesController": incentivesControllerAddress,
          "underlyingAssetName": underlyingAssetSymbol,
          "aTokenName": `Aave interest bearing ${underlyingAssetSymbol}`,
          "aTokenSymbol": `a${underlyingAssetSymbol}`,
          "variableDebtTokenName": `Aave variable debt bearing ${underlyingAssetSymbol}`,
          "variableDebtTokenSymbol": `variableDebt${underlyingAssetSymbol}`,
          "stableDebtTokenName": `Aave stable debt bearing ${underlyingAssetSymbol}`,
          "stableDebtTokenSymbol": `stableDebt${underlyingAssetSymbol}`,
          "params": "0x",
        },
      ]
    );

    // configure reserve
    await this.lendingPoolConfigurator.configureReserveAsCollateral(
      underlyingAsset,
      baseLTV,
      liquidationThreshold,
      liquidationBonus
    );
    if (borrowingEnabled) {
      await this.lendingPoolConfigurator.enableBorrowingOnReserve(underlyingAsset, stableBorrowingEnabled);
    }
    await this.lendingPoolConfigurator.setReserveFactor(underlyingAsset, reserveFactor);

    // LendingPoolConfigurator creates a new proxy contract and sets the passed in address as the implementation.
    // We then fetch the proxy's address and attach it to the contract object, which allows us to use the contract object
    // to call functions on the proxy
    const [aTokenProxy, stableDebtTokenProxy, variableDebtTokenProxy] = await this.protocolDataProvider.getReserveTokensAddresses(
      underlyingAsset
    );
    aToken = aToken.attach(aTokenProxy);
    stableDebtToken = stableDebtToken.attach(stableDebtTokenProxy);
    variableDebtToken = variableDebtToken.attach(variableDebtTokenProxy);

    return { aToken, stableDebtToken, variableDebtToken };
  }

  public async setAssetPriceInOracle(asset: Address, priceInEth: BigNumberish): Promise<void> {
    await this.fallbackOracle.setAssetPrice(asset, priceInEth);
  }

  public async setMarketBorrowRate(asset: Address, rate: BigNumberish): Promise<void> {
    await this.lendingRateOracle.setMarketBorrowRate(asset, rate);
  }

  public getForkedAaveLendingPoolAddressesProvider(): AaveV2LendingPoolAddressesProvider {
    return this._deployer.external.getForkedAaveLendingPoolAddressesProvider(dependencies.AAVE_LENDING_POOL_ADDRESSES_PROVIDER[1]);
  }

  public getForkedAaveV2ProtocolDataProvider(): AaveV2ProtocolDataProvider {
    return this._deployer.external.getForkedAaveV2ProtocolDataProvider(dependencies.AAVE_PROTOCOL_DATA_PROVIDER[1]);
  }

  private async initializeGovernance(): Promise<void> {

    // Deploy Executor
    this.executor = await this._deployer.external.deployExecutor(
      await this._ownerSigner.getAddress(),
      BigNumber.from(0),
      BigNumber.from(0),
      BigNumber.from(0),
      MAX_UINT_256,
      BigNumber.from(50),
      BigNumber.from(100),
      BigNumber.from(50),
      ether(100)
    );

    // Deploy Aave and stkAave
    this.aaveToken = await this._deployer.external.deployAaveTokenV2Mintable();
    await this.aaveToken.mint(await this._ownerSigner.getAddress(), ether(100000));
    this.stkAaveToken = await this._deployer.external.deployAaveTokenV2Mintable();
    await this.stkAaveToken.mint(await this._ownerSigner.getAddress(), ether(100000));

    // Deploy core gov contracts
    this.governanceStrategy = await this._deployer.external.deployGovernanceStrategy(this.aaveToken.address, this.stkAaveToken.address);
    this.aaveGovernanceV2 =  await this._deployer.external.deployAaveGovernanceV2(
      this.governanceStrategy.address,
      BigNumber.from(0),
      await this._ownerSigner.getAddress(),
      [this.executor.address]
    );

    // send some aave and stkAave to random addresses to initialize the vote snapshots
    this.aaveToken.connect(this._ownerSigner).transfer(await getRandomAddress(), 100);
    this.stkAaveToken.connect(this._ownerSigner).transfer(await getRandomAddress(), 100);

    // Deploy inventive controller
    await this._deployer.external.deployAaveV2StakedTokenIncentivesController(
      this.stkAaveToken.address, this.executor.address
    );

    this.incentivesControllerAddress = (await this._deployer.external.deployAaveV2StakedTokenIncentivesController(
      this.stkAaveToken.address, this.executor.address
    )).address;
  }
}

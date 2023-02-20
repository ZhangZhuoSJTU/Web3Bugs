//SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../contracts/mocks/MockERC20.sol";
import "../contracts/mocks/MockWETH.sol";
import "../contracts/mocks/MockMIMO.sol";
import "../contracts/mocks/MockInceptionAggregator.sol";
import "../contracts/access/AccessController.sol";
import "../contracts/core/AddressProvider.sol";
import "../contracts/core/ConfigProvider.sol";
import "../contracts/core/PriceFeed.sol";
import "../contracts/core/RatesManager.sol";
import "../contracts/core/LiquidiationManager.sol";
import "../contracts/fees/FeeDistributor.sol";
import "../contracts/core/VaultsDataProvider.sol";
import "../contracts/core/VaultsCoreState.sol";
import "../contracts/core/VaultsCore.sol";
import "../contracts/token/PAR.sol";
import "../contracts/governance/GovernanceAddressProvider.sol";
import "../contracts/liquidityMining/DebtNotifier.sol";
import "../contracts/liquidityMining/SupplyMiner.sol";
import "../contracts/inception/InceptionVaultFactory.sol";
import "../contracts/inception/AdminInceptionVault.sol";
import "../contracts/inception/InceptionVaultsCore.sol";
import "../contracts/inception/InceptionVaultsDataProvider.sol";
import "../contracts/inception/priceFeed/ChainlinkInceptionPriceFeed.sol";

import "../contracts/interfaces/IAddressProvider.sol";
import "../contracts/interfaces/IAccessController.sol";
import "../contracts/interfaces/IConfigProvider.sol";
import "../contracts/interfaces/IPriceFeed.sol";
import "../contracts/interfaces/IRatesManager.sol";
import "../contracts/interfaces/ILiquidationManager.sol";
import "../contracts/interfaces/IFeeDistributor.sol";
import "../contracts/interfaces/IVaultsDataProvider.sol";
import "../contracts/interfaces/IVaultsCoreState.sol";
import "../contracts/interfaces/IVaultsCore.sol";
import "../contracts/interfaces/IWETH.sol";
import "../contracts/interfaces/ISTABLEX.sol";
import "../contracts/interfaces/IFeeDistributor.sol";
import "../contracts/chainlink/AggregatorV3Interface.sol";
import "../contracts/governance/interfaces/IGovernanceAddressProvider.sol";
import "../contracts/liquidityMining/interfaces/IDebtNotifier.sol";
import "../contracts/liquidityMining/interfaces/ISupplyMiner.sol";
import "../contracts/liquidityMining/interfaces/IMIMO.sol";
import "../contracts/inception/interfaces/IInceptionVaultPriceFeed.sol";

contract TIVSetup {
  MockERC20 internal _wbtc;
  MockERC20 internal _usdc;
  MockERC20 internal _link;
  MockWETH internal _weth;
  MockMIMO internal _mimo;
  PAR internal _par;
  MockInceptionAggregator internal _wbtcAggregator;
  MockInceptionAggregator internal _wethAggregator;
  MockInceptionAggregator internal _usdcAggregator;
  MockInceptionAggregator internal _eurUsdAggregator;
  MockInceptionAggregator internal _linkAggregator;

  AccessController internal _accessController;
  AddressProvider internal _addressProvider;
  ConfigProvider internal _configProvider;
  PriceFeed internal _priceFeed;
  RatesManager internal _ratesManager;
  LiquidationManager internal _liquidationManager;
  FeeDistributor internal _feeDistributor;
  VaultsDataProvider internal _vaultsDataProvider;
  VaultsCoreState internal _vaultsCoreState;
  VaultsCore internal _vaultsCore;
  GovernanceAddressProvider internal _governanceAddressProvider;
  DebtNotifier internal _debtNotifier;
  SupplyMiner internal _wbtcSupplyMiner;
  SupplyMiner internal _wethSupplyMiner;
  SupplyMiner internal _usdcSupplyMiner;
  InceptionVaultFactory internal _inceptionVaultFactory;
  AdminInceptionVault internal _baseAdminInceptionVault;
  InceptionVaultsCore internal _baseInceptionVaultsCore;
  InceptionVaultsDataProvider internal _baseInceptionVaultsDataProvider;
  ChainlinkInceptionPriceFeed internal _baseChainlinkInceptionPriceFeed;

  uint256 internal constant _MAX_INT = 2**256 - 1;
  address internal _echidna_caller = 0x00a329c0648769A73afAc7F9381E08FB43dBEA72;

  constructor() public payable {
    // Deploy Mock Contracts
    _wbtc = new MockERC20("Wrapped BTC", "WBTC", 18);
    _usdc = new MockERC20("USD Coin", "USDC", 6);
    _link = new MockERC20("Link Token", "LINK", 18);
    _mimo = new MockMIMO();
    _weth = new MockWETH();
    _wbtcAggregator = new MockInceptionAggregator(8, 3600000000000, "WBTC / USD");
    _wethAggregator = new MockInceptionAggregator(8, 250000000000, "WETH / USD");
    _usdcAggregator = new MockInceptionAggregator(8, 100000000, "USDC / USD");
    _eurUsdAggregator = new MockInceptionAggregator(8, 113224640, "EUR / USD");
    _linkAggregator = new MockInceptionAggregator(8, 1400000000, "LINK/ USD");

    // Deploy Core
    _accessController = new AccessController();
    _addressProvider = new AddressProvider(IAccessController(address(_accessController)));
    _configProvider = new ConfigProvider(IAddressProvider(address(_addressProvider)));
    _priceFeed = new PriceFeed(IAddressProvider(address(_addressProvider)));
    _ratesManager = new RatesManager(IAddressProvider(address(_addressProvider)));
    _liquidationManager = new LiquidationManager(IAddressProvider(address(_addressProvider)));
    _feeDistributor = new FeeDistributor(IAddressProvider(address(_addressProvider)));
    _vaultsDataProvider = new VaultsDataProvider(IAddressProvider(address(_addressProvider)));
    _vaultsCoreState = new VaultsCoreState(IAddressProvider(address(_addressProvider)));
    _vaultsCore = new VaultsCore(
      IAddressProvider(address(_addressProvider)),
      IWETH(address(_weth)),
      IVaultsCoreState(address(_vaultsCoreState))
    );
    _par = new PAR(IAddressProvider(address(_addressProvider)));
    _addressProvider.setAccessController(IAccessController(address(_accessController)));

    // Set Core Providers
    _addressProvider.setConfigProvider(IConfigProvider(address(_configProvider)));
    _addressProvider.setVaultsCore(IVaultsCore(address(_vaultsCore)));
    _addressProvider.setStableX(ISTABLEX(address(_par)));
    _addressProvider.setRatesManager(IRatesManager(address(_ratesManager)));
    _addressProvider.setPriceFeed(IPriceFeed(address(_priceFeed)));
    _addressProvider.setLiquidationManager(ILiquidationManager(address(_liquidationManager)));
    _addressProvider.setFeeDistributor(IFeeDistributor(address(_feeDistributor)));
    _addressProvider.setVaultsDataProvider(IVaultsDataProvider(address(_vaultsDataProvider)));

    // Set Price Feed
    _priceFeed.setAssetOracle(address(_weth), address(_wethAggregator));
    _priceFeed.setAssetOracle(address(_wbtc), address(_wbtcAggregator));
    _priceFeed.setAssetOracle(address(_usdc), address(_usdcAggregator));
    _priceFeed.setEurOracle(address(_eurUsdAggregator));

    // Set Access
    _accessController.grantRole(_accessController.MINTER_ROLE(), address(_feeDistributor));
    _accessController.grantRole(_accessController.MINTER_ROLE(), address(_vaultsCore));

    // Set Fees
    address[] memory payees = new address[](1);
    uint256[] memory shares = new uint256[](1);
    payees[0] = address(_vaultsCore);
    shares[0] = 100;
    _feeDistributor.changePayees(payees, shares);

    // Set Collateral Configs
    _configProvider.setCollateralConfig(
      address(_weth),
      17000000000000000000000000,
      1300000000000000000,
      1300000000000000000,
      1000000000937303470807876290,
      3000000000000000,
      50000000000000000,
      0
    );
    _configProvider.setCollateralConfig(
      address(_wbtc),
      6000000000000000000000000,
      1300000000000000000,
      1300000000000000000,
      1000000000937303470807876290,
      3000000000000000,
      50000000000000000,
      0
    );
    _configProvider.setCollateralConfig(
      address(_usdc),
      4000000000000000000000000,
      1100000000000000000,
      1100000000000000000,
      1000000000937303470807876290,
      3000000000000000,
      50000000000000000,
      0
    );

    // Deploy Governance
    _governanceAddressProvider = new GovernanceAddressProvider(IAddressProvider(address(_addressProvider)));
    _debtNotifier = new DebtNotifier(IGovernanceAddressProvider(address(_governanceAddressProvider)));
    _wbtcSupplyMiner = new SupplyMiner(IGovernanceAddressProvider(address(_governanceAddressProvider)));
    _wethSupplyMiner = new SupplyMiner(IGovernanceAddressProvider(address(_governanceAddressProvider)));
    _usdcSupplyMiner = new SupplyMiner(IGovernanceAddressProvider(address(_governanceAddressProvider)));

    // Set Governance
    _vaultsCore.setDebtNotifier(IDebtNotifier(address(_debtNotifier)));
    _governanceAddressProvider.setParallelAddressProvider(IAddressProvider(address(_addressProvider)));
    _governanceAddressProvider.setMIMO(IMIMO(address(_mimo)));
    _governanceAddressProvider.setDebtNotifier(IDebtNotifier(address(_debtNotifier)));

    // Deploy Inception
    _baseAdminInceptionVault = new AdminInceptionVault();
    _baseInceptionVaultsCore = new InceptionVaultsCore();
    _baseInceptionVaultsDataProvider = new InceptionVaultsDataProvider();
    _inceptionVaultFactory = new InceptionVaultFactory(
      address(_baseAdminInceptionVault),
      address(_baseInceptionVaultsCore),
      address(_baseInceptionVaultsDataProvider),
      IAddressProvider(address(_addressProvider)),
      IDebtNotifier(address(_debtNotifier)),
      IWETH(address(_weth)),
      IMIMO(address(_mimo))
    );
    _baseChainlinkInceptionPriceFeed = new ChainlinkInceptionPriceFeed();
    _inceptionVaultFactory.addPriceFeed(address(_baseChainlinkInceptionPriceFeed));
    IInceptionVaultsCore.VaultConfig memory v = IInceptionVaultsCore.VaultConfig({
      liquidationRatio: 1300000000000000000,
      minCollateralRatio: 1500000000000000000,
      borrowRate: 1000000000534535675765102250,
      originationFee: 3000000000000000,
      liquidationBonus: 50000000000000000,
      liquidationFee: 0
    });
    _inceptionVaultFactory.cloneInceptionVault(
      v,
      _link,
      address(_baseChainlinkInceptionPriceFeed),
      address(_linkAggregator)
    );
  }
}

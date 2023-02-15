//SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./BoringOwnable.sol";
import "./interfaces/IInceptionVaultFactory.sol";
import "./interfaces/IAdminInceptionVault.sol";
import "./interfaces/IInceptionVaultsCore.sol";
import "./interfaces/IInceptionVaultsDataProvider.sol";
import "./interfaces/IInceptionVaultPriceFeed.sol";
import "../chainlink/AggregatorV3Interface.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IAddressProvider.sol";
import "../liquidityMining/interfaces/IGenericMiner.sol";
import "../liquidityMining/interfaces/IDebtNotifier.sol";

contract InceptionVaultFactory is IInceptionVaultFactory, BoringOwnable {
  using Clones for address;

  IAddressProvider private immutable _a;
  IDebtNotifier private immutable _debtNotifier;
  IWETH private immutable _weth;
  IERC20 private immutable _mimo;
  address private immutable _adminInceptionVaultBase;
  address private immutable _inceptionVaultsCoreBase;
  address private immutable _inceptionVaultsDataProviderBase;

  uint8 private _priceFeedCount;
  uint256 private _inceptionVaultCount;

  mapping(uint256 => InceptionVault) private _inceptionVaults;
  mapping(uint8 => address) private _priceFeeds;
  mapping(address => uint8) private _priceFeedIds;

  constructor(
    address adminInceptionVaultBase,
    address inceptionVaultsCoreBase,
    address inceptionVaultsDataProviderBase,
    IAddressProvider addressProvider,
    IDebtNotifier debtNotifier,
    IWETH weth,
    IERC20 mimo
  ) public {
    require(adminInceptionVaultBase != address(0), "IV000");
    require(inceptionVaultsCoreBase != address(0), "IV000");
    require(inceptionVaultsDataProviderBase != address(0), "IV000");
    require(address(addressProvider) != address(0), "IV000");
    require(address(debtNotifier) != address(0), "IV000");
    require(address(weth) != address(0), "IV000");
    require(address(mimo) != address(0), "IV000");
    _adminInceptionVaultBase = adminInceptionVaultBase;
    _inceptionVaultsCoreBase = inceptionVaultsCoreBase;
    _inceptionVaultsDataProviderBase = inceptionVaultsDataProviderBase;
    _a = addressProvider;
    _debtNotifier = debtNotifier;
    _weth = weth;
    _mimo = mimo;
  }

  /**
    Clones and initializes all 3 Inception Vault contracts : AdminInceptionVault, InceptionVaultsCore, InceptionVaultsDataProvider.
    @param _vaultConfig the inception vault configuration paramaters, see {IInceptionVaultFactory - VaultConfig}.
    @param _inceptionCollateral the address of the ERC20 token that will be set as inceptionCollateral
  */
  function cloneInceptionVault(
    IInceptionVaultsCore.VaultConfig calldata _vaultConfig,
    IERC20 _inceptionCollateral,
    address _inceptionVaultPriceFeed,
    address _assetOracle
  ) external override {
    require(address(_inceptionCollateral) != address(0), "IV000");
    require(_inceptionVaultPriceFeed != address(0), "IV000");
    IAdminInceptionVault adminInceptionVault = IAdminInceptionVault(_adminInceptionVaultBase.clone());
    IInceptionVaultsCore inceptionVaultsCore = IInceptionVaultsCore(_inceptionVaultsCoreBase.clone());
    IInceptionVaultsDataProvider inceptionVaultsDataProvider = IInceptionVaultsDataProvider(
      _inceptionVaultsDataProviderBase.clone()
    );
    IInceptionVaultPriceFeed inceptionVaultPriceFeed;
    bool isCustomPriceFeed;

    if (_priceFeedIds[_inceptionVaultPriceFeed] != 0) {
      require(address(_assetOracle) != address(0), "IV000");
      inceptionVaultPriceFeed = IInceptionVaultPriceFeed(_inceptionVaultPriceFeed.clone());
      inceptionVaultPriceFeed.initialize(_a, address(_inceptionCollateral), _assetOracle, _a.priceFeed().eurOracle());
    } else {
      require(address(_assetOracle) == address(0), "IV001");
      inceptionVaultPriceFeed = IInceptionVaultPriceFeed(_inceptionVaultPriceFeed);
      isCustomPriceFeed = true;
    }

    adminInceptionVault.initialize(msg.sender, _a, _debtNotifier, _weth, _mimo, inceptionVaultsCore);

    inceptionVaultsCore.initialize(
      msg.sender,
      _vaultConfig,
      _inceptionCollateral,
      _a,
      adminInceptionVault,
      inceptionVaultsDataProvider,
      inceptionVaultPriceFeed
    );

    inceptionVaultsDataProvider.initialize(inceptionVaultsCore, _a);

    uint256 newId = ++_inceptionVaultCount;
    InceptionVault memory v = InceptionVault({
      owner: msg.sender,
      adminInceptionVault: adminInceptionVault,
      inceptionVaultsCore: inceptionVaultsCore,
      inceptionVaultsDataProvider: inceptionVaultsDataProvider,
      inceptionVaultPriceFeed: inceptionVaultPriceFeed,
      isCustomPriceFeed: isCustomPriceFeed
    });

    _inceptionVaults[newId] = v;

    emit InceptionVaultDeployed(
      msg.sender,
      adminInceptionVault,
      inceptionVaultsCore,
      inceptionVaultsDataProvider,
      inceptionVaultPriceFeed
    );
  }

  function addPriceFeed(address _address) external override onlyOwner {
    require(_address != address(0), "IV000");
    require(_priceFeedIds[_address] == 0, "IV002");
    uint8 newId = ++_priceFeedCount;
    _priceFeeds[newId] = _address;
    _priceFeedIds[_address] = newId;
    emit PriceFeedAdded(newId, _address);
  }

  function a() public view override returns (IAddressProvider) {
    return _a;
  }

  function debtNotifier() public view override returns (IDebtNotifier) {
    return _debtNotifier;
  }

  function weth() public view override returns (IWETH) {
    return _weth;
  }

  function mimo() public view override returns (IERC20) {
    return _mimo;
  }

  function adminInceptionVaultBase() public view override returns (address) {
    return _adminInceptionVaultBase;
  }

  function inceptionVaultsCoreBase() public view override returns (address) {
    return _inceptionVaultsCoreBase;
  }

  function inceptionVaultsDataProviderBase() public view override returns (address) {
    return _inceptionVaultsDataProviderBase;
  }

  function inceptionVaultCount() public view override returns (uint256) {
    return _inceptionVaultCount;
  }

  function priceFeedCount() public view override returns (uint8) {
    return _priceFeedCount;
  }

  function inceptionVaults(uint256 _id) public view override returns (InceptionVault memory) {
    return _inceptionVaults[_id];
  }

  function priceFeeds(uint8 _id) public view override returns (address) {
    return _priceFeeds[_id];
  }

  function priceFeedIds(address _priceFeed) public view override returns (uint16) {
    return _priceFeedIds[_priceFeed];
  }
}

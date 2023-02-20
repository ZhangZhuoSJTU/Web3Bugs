// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../interfaces/IAddressProvider.sol";
import "../interfaces/IVaultsCore.sol";
import "../interfaces/IAccessController.sol";
import "../interfaces/IConfigProvider.sol";
import "../interfaces/ISTABLEX.sol";
import "../interfaces/IPriceFeed.sol";
import "../interfaces/IRatesManager.sol";
import "../interfaces/IVaultsDataProvider.sol";
import "./interfaces/IConfigProviderV1.sol";
import "./interfaces/ILiquidationManagerV1.sol";
import "./interfaces/IVaultsCoreV1.sol";

contract AddressProviderV1 is IAddressProvider {
  IAccessController public override controller;
  IConfigProvider public override config;
  IVaultsCore public override core;

  ISTABLEX public override stablex;
  IRatesManager public override ratesManager;
  IPriceFeed public override priceFeed;
  ILiquidationManager public override liquidationManager;
  IVaultsDataProvider public override vaultsData;
  IFeeDistributor public override feeDistributor;

  constructor(IAccessController _controller) public {
    controller = _controller;
  }

  modifier onlyManager() {
    require(controller.hasRole(controller.MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  function setAccessController(IAccessController _controller) public override onlyManager {
    require(address(_controller) != address(0));
    controller = _controller;
  }

  function setConfigProvider(IConfigProvider _config) public override onlyManager {
    require(address(_config) != address(0));
    config = _config;
  }

  function setVaultsCore(IVaultsCore _core) public override onlyManager {
    require(address(_core) != address(0));
    core = _core;
  }

  function setStableX(ISTABLEX _stablex) public override onlyManager {
    require(address(_stablex) != address(0));
    stablex = _stablex;
  }

  function setRatesManager(IRatesManager _ratesManager) public override onlyManager {
    require(address(_ratesManager) != address(0));
    ratesManager = _ratesManager;
  }

  function setLiquidationManager(ILiquidationManager _liquidationManager) public override onlyManager {
    require(address(_liquidationManager) != address(0));
    liquidationManager = _liquidationManager;
  }

  function setPriceFeed(IPriceFeed _priceFeed) public override onlyManager {
    require(address(_priceFeed) != address(0));
    priceFeed = _priceFeed;
  }

  function setVaultsDataProvider(IVaultsDataProvider _vaultsData) public override onlyManager {
    require(address(_vaultsData) != address(0));
    vaultsData = _vaultsData;
  }

  function setFeeDistributor(IFeeDistributor _feeDistributor) public override onlyManager {
    require(address(_feeDistributor) != address(0));
    feeDistributor = _feeDistributor;
  }
}

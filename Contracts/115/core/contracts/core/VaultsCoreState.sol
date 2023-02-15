// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../libraries/WadRayMath.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IVaultsCoreState.sol";
import "../v1/interfaces/IVaultsCoreV1.sol";

contract VaultsCoreState is IVaultsCoreState {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 internal constant _MAX_INT = 2**256 - 1;

  bool public override synced = false;
  IAddressProvider public override a;

  mapping(address => uint256) public override cumulativeRates;
  mapping(address => uint256) public override lastRefresh;

  modifier onlyConfig() {
    require(msg.sender == address(a.config()));
    _;
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender));
    _;
  }

  modifier notSynced() {
    require(!synced);
    _;
  }

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  /**
    Calculate the available income
    @return available income that has not been minted yet.
  **/
  function availableIncome() public view override returns (uint256) {
    return a.vaultsData().debt().sub(a.stablex().totalSupply());
  }

  /**
    Refresh the cumulative rates and debts of all vaults and all collateral types.
    @dev anyone can call this.
  **/
  function refresh() public override {
    for (uint256 i = 1; i <= a.config().numCollateralConfigs(); i++) {
      address collateralType = a.config().collateralConfigs(i).collateralType;
      refreshCollateral(collateralType);
    }
  }

  /**
    Sync state with another instance. This is used during version upgrade to keep V2 in sync with V2.
    @dev This call will read the state via
      `cumulativeRates(address collateralType)` and `lastRefresh(address collateralType)`.
    @param _stateAddress address from which the state is to be copied.
  **/
  function syncState(IVaultsCoreState _stateAddress) public override onlyManager notSynced {
    for (uint256 i = 1; i <= a.config().numCollateralConfigs(); i++) {
      address collateralType = a.config().collateralConfigs(i).collateralType;
      cumulativeRates[collateralType] = _stateAddress.cumulativeRates(collateralType);
      lastRefresh[collateralType] = _stateAddress.lastRefresh(collateralType);
    }
    synced = true;
  }

  /**
    Sync state with v1 core. This is used during version upgrade to keep V2 in sync with V1.
    @dev This call will read the state via
      `cumulativeRates(address collateralType)` and `lastRefresh(address collateralType)`.
    @param _core address of core v1 from which the state is to be copied.
  **/
  function syncStateFromV1(IVaultsCoreV1 _core) public override onlyManager notSynced {
    for (uint256 i = 1; i <= a.config().numCollateralConfigs(); i++) {
      address collateralType = a.config().collateralConfigs(i).collateralType;
      cumulativeRates[collateralType] = _core.cumulativeRates(collateralType);
      lastRefresh[collateralType] = _core.lastRefresh(collateralType);
    }
    synced = true;
  }

  /**
    Initialize the cumulative rates to 1 for a new collateral type.
    @param _collateralType the address of the new collateral type to be initialized
  **/
  function initializeRates(address _collateralType) public override onlyConfig {
    require(_collateralType != address(0));
    lastRefresh[_collateralType] = block.timestamp;
    cumulativeRates[_collateralType] = WadRayMath.ray();
  }

  /**
    Refresh the cumulative rate of a collateraltype.
    @dev this updates the debt for all vaults with the specified collateral type.
    @param _collateralType the address of the collateral type to be refreshed.
  **/
  function refreshCollateral(address _collateralType) public override {
    require(_collateralType != address(0));
    require(a.config().collateralIds(_collateralType) != 0);
    uint256 timestamp = block.timestamp;
    uint256 timeElapsed = timestamp.sub(lastRefresh[_collateralType]);
    _refreshCumulativeRate(_collateralType, timeElapsed);
    lastRefresh[_collateralType] = timestamp;
  }

  /**
    Internal function to increase the cumulative rate over a specified time period
    @dev this updates the debt for all vaults with the specified collateral type.
    @param _collateralType the address of the collateral type to be updated
    @param _timeElapsed the amount of time in seconds to add to the cumulative rate
  **/
  function _refreshCumulativeRate(address _collateralType, uint256 _timeElapsed) internal {
    uint256 borrowRate = a.config().collateralBorrowRate(_collateralType);
    uint256 oldCumulativeRate = cumulativeRates[_collateralType];
    cumulativeRates[_collateralType] = a.ratesManager().calculateCumulativeRate(
      borrowRate,
      oldCumulativeRate,
      _timeElapsed
    );
    emit CumulativeRateUpdated(_collateralType, _timeElapsed, cumulativeRates[_collateralType]);
  }
}

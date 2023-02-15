// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../libraries/WadRayMath.sol";
import "./interfaces/IConfigProviderV1.sol";
import "./interfaces/IAddressProviderV1.sol";
import "./interfaces/IVaultsCoreV1.sol";

contract ConfigProviderV1 is IConfigProviderV1 {
  IAddressProviderV1 public override a;

  mapping(uint256 => CollateralConfig) private _collateralConfigs; //indexing starts at 1
  mapping(address => uint256) public override collateralIds;

  uint256 public override numCollateralConfigs;
  uint256 public override liquidationBonus = 5e16; // 5%

  constructor(IAddressProviderV1 _addresses) public {
    a = _addresses;
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  /**
    Creates or overwrites an existing config for a collateral type
    @param _collateralType address of the collateral type
    @param _debtLimit the debt ceiling for the collateral type
    @param _minCollateralRatio the minimum ratio to maintain to avoid liquidation
    @param _borrowRate the borrowing rate specified in 1 second interval in RAY accuracy.
    @param _originationFee an optional origination fee for newly created debt. Can be 0.
  */
  function setCollateralConfig(
    address _collateralType,
    uint256 _debtLimit,
    uint256 _minCollateralRatio,
    uint256 _borrowRate,
    uint256 _originationFee
  ) public override onlyManager {
    require(address(_collateralType) != address(0));
    if (collateralIds[_collateralType] == 0) {
      //new collateral
      IVaultsCoreV1(address(a.core())).initializeRates(_collateralType);
      CollateralConfig memory config = CollateralConfig({
        collateralType: _collateralType,
        debtLimit: _debtLimit,
        minCollateralRatio: _minCollateralRatio,
        borrowRate: _borrowRate,
        originationFee: _originationFee
      });

      numCollateralConfigs++;
      _collateralConfigs[numCollateralConfigs] = config;
      collateralIds[_collateralType] = numCollateralConfigs;
    } else {
      // Update collateral config
      IVaultsCoreV1(address(a.core())).refreshCollateral(_collateralType);
      uint256 id = collateralIds[_collateralType];

      _collateralConfigs[id].collateralType = _collateralType;
      _collateralConfigs[id].debtLimit = _debtLimit;
      _collateralConfigs[id].minCollateralRatio = _minCollateralRatio;
      _collateralConfigs[id].borrowRate = _borrowRate;
      _collateralConfigs[id].originationFee = _originationFee;
    }
    emit CollateralUpdated(_collateralType, _debtLimit, _minCollateralRatio, _borrowRate, _originationFee);
  }

  function _emitUpdateEvent(address _collateralType) internal {
    emit CollateralUpdated(
      _collateralType,
      _collateralConfigs[collateralIds[_collateralType]].debtLimit,
      _collateralConfigs[collateralIds[_collateralType]].minCollateralRatio,
      _collateralConfigs[collateralIds[_collateralType]].borrowRate,
      _collateralConfigs[collateralIds[_collateralType]].originationFee
    );
  }

  /**
    Remove the config for a collateral type
    @param _collateralType address of the collateral type
  */
  function removeCollateral(address _collateralType) public override onlyManager {
    uint256 id = collateralIds[_collateralType];
    require(id != 0, "collateral does not exist");

    collateralIds[_collateralType] = 0;

    _collateralConfigs[id] = _collateralConfigs[numCollateralConfigs]; //move last entry forward
    collateralIds[_collateralConfigs[id].collateralType] = id; //update id for last entry
    delete _collateralConfigs[numCollateralConfigs];
    numCollateralConfigs--;

    emit CollateralRemoved(_collateralType);
  }

  /**
    Sets the debt limit for a collateral type
    @param _collateralType address of the collateral type
    @param _debtLimit the new debt limit
  */
  function setCollateralDebtLimit(address _collateralType, uint256 _debtLimit) public override onlyManager {
    _collateralConfigs[collateralIds[_collateralType]].debtLimit = _debtLimit;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the minimum collateralization ratio for a collateral type
    @dev this is the liquidation treshold under which a vault is considered open for liquidation.
    @param _collateralType address of the collateral type
    @param _minCollateralRatio the new minimum collateralization ratio
  */
  function setCollateralMinCollateralRatio(address _collateralType, uint256 _minCollateralRatio)
    public
    override
    onlyManager
  {
    _collateralConfigs[collateralIds[_collateralType]].minCollateralRatio = _minCollateralRatio;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the borrowing rate for a collateral type
    @dev borrowing rate is specified for a 1 sec interval and accurancy is in RAY.
    @param _collateralType address of the collateral type
    @param _borrowRate the new borrowing rate for a 1 sec interval
  */
  function setCollateralBorrowRate(address _collateralType, uint256 _borrowRate) public override onlyManager {
    IVaultsCoreV1(address(a.core())).refreshCollateral(_collateralType);
    _collateralConfigs[collateralIds[_collateralType]].borrowRate = _borrowRate;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Sets the origiation fee for a collateral type
    @dev this rate is applied as a one time fee for new borrowing and is specified in WAD
    @param _collateralType address of the collateral type
    @param _originationFee new origination fee in WAD
  */
  function setCollateralOriginationFee(address _collateralType, uint256 _originationFee) public override onlyManager {
    _collateralConfigs[collateralIds[_collateralType]].originationFee = _originationFee;
    _emitUpdateEvent(_collateralType);
  }

  /**
    Get the debt limit for a collateral type
    @dev this is a platform wide limit for new debt issuance against a specific collateral type
    @param _collateralType address of the collateral type
  */
  function collateralDebtLimit(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].debtLimit;
  }

  /**
    Get the minimum collateralization ratio for a collateral type
    @dev this is the liquidation treshold under which a vault is considered open for liquidation.
    @param _collateralType address of the collateral type
  */
  function collateralMinCollateralRatio(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].minCollateralRatio;
  }

  /**
    Get the borrowing rate for a collateral type
    @dev borrowing rate is specified for a 1 sec interval and accurancy is in RAY.
    @param _collateralType address of the collateral type
  */
  function collateralBorrowRate(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].borrowRate;
  }

  /**
    Get the origiation fee for a collateral type
    @dev this rate is applied as a one time fee for new borrowing and is specified in WAD
    @param _collateralType address of the collateral type
  */
  function collateralOriginationFee(address _collateralType) public view override returns (uint256) {
    return _collateralConfigs[collateralIds[_collateralType]].originationFee;
  }

  /**
    Set the platform wide incentive for liquidations.
    @dev the liquidation bonus is specified in WAD
    @param _bonus the liquidation bonus to be paid to liquidators
  */
  function setLiquidationBonus(uint256 _bonus) public override onlyManager {
    liquidationBonus = _bonus;
  }

  /**
    Retreives the entire config for a specific config id.
    @param _id the ID of the conifg to be returned
  */
  function collateralConfigs(uint256 _id) public view override returns (CollateralConfig memory) {
    require(_id <= numCollateralConfigs, "Invalid config id");
    return _collateralConfigs[_id];
  }
}

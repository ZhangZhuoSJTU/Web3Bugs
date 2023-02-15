// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/WadRayMath.sol";
import "../interfaces/ILiquidationManager.sol";
import "../interfaces/IAddressProvider.sol";

contract LiquidationManager is ILiquidationManager, ReentrancyGuard {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IAddressProvider public override a;

  uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18; // 1

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  /**
    Check if the health factor is above or equal to 1.
    @param _collateralValue value of the collateral in PAR
    @param _vaultDebt outstanding debt to which the collateral balance shall be compared
    @param _minRatio min ratio to calculate health factor
    @return boolean if the health factor is >= 1.
  */
  function isHealthy(
    uint256 _collateralValue,
    uint256 _vaultDebt,
    uint256 _minRatio
  ) public view override returns (bool) {
    uint256 healthFactor = calculateHealthFactor(_collateralValue, _vaultDebt, _minRatio);
    return healthFactor >= HEALTH_FACTOR_LIQUIDATION_THRESHOLD;
  }

  /**
    Calculate the healthfactor of a debt balance
    @param _collateralValue value of the collateral in PAR currency
    @param _vaultDebt outstanding debt to which the collateral balance shall be compared
    @param _minRatio min ratio to calculate health factor
    @return healthFactor
  */
  function calculateHealthFactor(
    uint256 _collateralValue,
    uint256 _vaultDebt,
    uint256 _minRatio
  ) public view override returns (uint256 healthFactor) {
    if (_vaultDebt == 0) return WadRayMath.wad();

    // CurrentCollateralizationRatio = value(deposited ETH) / debt
    uint256 collateralizationRatio = _collateralValue.wadDiv(_vaultDebt);

    // Healthfactor = CurrentCollateralizationRatio / MinimumCollateralizationRatio
    if (_minRatio > 0) {
      return collateralizationRatio.wadDiv(_minRatio);
    }

    return 1e18; // 1
  }

  /**
    Calculate the liquidation bonus for a specified amount
    @param _collateralType address of the collateral type
    @param _amount amount for which the liquidation bonus shall be calculated
    @return bonus the liquidation bonus to pay out
  */
  function liquidationBonus(address _collateralType, uint256 _amount) public view override returns (uint256 bonus) {
    return _amount.wadMul(a.config().collateralLiquidationBonus(_collateralType));
  }

  /**
    Apply the liquidation bonus to a balance as a discount.
    @param _collateralType address of the collateral type
    @param _amount the balance on which to apply to liquidation bonus as a discount.
    @return discountedAmount
  */
  function applyLiquidationDiscount(address _collateralType, uint256 _amount)
    public
    view
    override
    returns (uint256 discountedAmount)
  {
    return _amount.wadDiv(a.config().collateralLiquidationBonus(_collateralType).add(WadRayMath.wad()));
  }
}

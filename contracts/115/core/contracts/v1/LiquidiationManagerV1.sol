// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/WadRayMath.sol";
import "./interfaces/IAddressProviderV1.sol";
import "./interfaces/IConfigProviderV1.sol";
import "./interfaces/ILiquidationManagerV1.sol";

contract LiquidationManagerV1 is ILiquidationManagerV1, ReentrancyGuard {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IAddressProviderV1 public override a;

  uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1e18; // 1
  uint256 public constant FULL_LIQUIDIATION_TRESHOLD = 100e18; // 100 USDX, vaults below 100 USDX can be liquidated in full

  constructor(IAddressProviderV1 _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  /**
    Check if the health factor is above or equal to 1.
    @param _collateralType address of the collateral type
    @param _collateralValue value of the collateral in stableX currency
    @param _vaultDebt outstanding debt to which the collateral balance shall be compared
    @return boolean if the health factor is >= 1.
  */
  function isHealthy(
    address _collateralType,
    uint256 _collateralValue,
    uint256 _vaultDebt
  ) public view override returns (bool) {
    uint256 healthFactor = calculateHealthFactor(_collateralType, _collateralValue, _vaultDebt);
    return healthFactor >= HEALTH_FACTOR_LIQUIDATION_THRESHOLD;
  }

  /**
    Calculate the healthfactor of a debt balance
    @param _collateralType address of the collateral type
    @param _collateralValue value of the collateral in stableX currency
    @param _vaultDebt outstanding debt to which the collateral balance shall be compared
    @return healthFactor
  */
  function calculateHealthFactor(
    address _collateralType,
    uint256 _collateralValue,
    uint256 _vaultDebt
  ) public view override returns (uint256 healthFactor) {
    if (_vaultDebt == 0) return WadRayMath.wad();

    // CurrentCollateralizationRatio = deposited ETH in USD / debt in USD
    uint256 collateralizationRatio = _collateralValue.wadDiv(_vaultDebt);

    // Healthfactor = CurrentCollateralizationRatio / MinimumCollateralizationRatio

    uint256 collateralId = a.config().collateralIds(_collateralType);
    require(collateralId > 0, "collateral not supported");

    uint256 minRatio = a.config().collateralConfigs(collateralId).minCollateralRatio;
    if (minRatio > 0) {
      return collateralizationRatio.wadDiv(minRatio);
    }

    return 1e18; // 1
  }

  /**
    Calculate the liquidation bonus for a specified amount
    @param _amount amount for which the liquidation bonus shall be calculated
    @return bonus the liquidation bonus to pay out
  */
  function liquidationBonus(uint256 _amount) public view override returns (uint256 bonus) {
    return _amount.wadMul(IConfigProviderV1(address(a.config())).liquidationBonus());
  }

  /**
    Apply the liquidation bonus to a balance as a discount.
    @param _amount the balance on which to apply to liquidation bonus as a discount.
    @return discountedAmount
  */
  function applyLiquidationDiscount(uint256 _amount) public view override returns (uint256 discountedAmount) {
    return _amount.wadDiv(IConfigProviderV1(address(a.config())).liquidationBonus().add(WadRayMath.wad()));
  }
}

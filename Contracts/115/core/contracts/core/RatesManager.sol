// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/WadRayMath.sol";
import "../interfaces/IRatesManager.sol";
import "../interfaces/IAddressProvider.sol";

contract RatesManager is IRatesManager {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 private constant _SECONDS_PER_YEAR = 365 days;

  IAddressProvider public override a;

  constructor(IAddressProvider _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  /**
    Calculate the annualized borrow rate from the specified borrowing rate.
    @param _borrowRate rate for a 1 second interval specified in RAY accuracy.
    @return annualized rate
  */
  function annualizedBorrowRate(uint256 _borrowRate) public pure override returns (uint256) {
    return _borrowRate.rayPow(_SECONDS_PER_YEAR);
  }

  /**
    Calculate the total debt from a specified base debt and cumulative rate.
    @param _baseDebt the base debt to be used. Can be a vault base debt or an aggregate base debt
    @param _cumulativeRate the cumulative rate in RAY accuracy.
    @return debt after applying the cumulative rate
  */
  function calculateDebt(uint256 _baseDebt, uint256 _cumulativeRate) public pure override returns (uint256 debt) {
    return _baseDebt.rayMul(_cumulativeRate);
  }

  /**
    Calculate the base debt from a specified total debt and cumulative rate.
    @param _debt the total debt to be used.
    @param _cumulativeRate the cumulative rate in RAY accuracy.
    @return baseDebt the new base debt
  */
  function calculateBaseDebt(uint256 _debt, uint256 _cumulativeRate) public pure override returns (uint256 baseDebt) {
    return _debt.rayDiv(_cumulativeRate);
  }

  /**
    Bring an existing cumulative rate forward in time
    @param _borrowRate rate for a 1 second interval specified in RAY accuracy to be applied
    @param _timeElapsed the time over whicht the borrow rate shall be applied
    @param _cumulativeRate the initial cumulative rate from which to apply the borrow rate
    @return new cumulative rate
  */
  function calculateCumulativeRate(
    uint256 _borrowRate,
    uint256 _cumulativeRate,
    uint256 _timeElapsed
  ) public view override returns (uint256) {
    if (_timeElapsed == 0) return _cumulativeRate;
    uint256 cumulativeElapsed = _borrowRate.rayPow(_timeElapsed);
    return _cumulativeRate.rayMul(cumulativeElapsed);
  }
}

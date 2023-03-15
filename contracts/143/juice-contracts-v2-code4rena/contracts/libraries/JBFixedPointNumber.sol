// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

library JBFixedPointNumber {
  function adjustDecimals(
    uint256 _value,
    uint256 _decimals,
    uint256 _targetDecimals
  ) internal pure returns (uint256) {
    // If decimals need adjusting, multiply or divide the price by the decimal adjuster to get the normalized result.
    if (_targetDecimals == _decimals) return _value;
    else if (_targetDecimals > _decimals) return _value * 10**(_targetDecimals - _decimals);
    else return _value / 10**(_decimals - _targetDecimals);
  }
}

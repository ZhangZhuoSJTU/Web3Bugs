// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IFixedUintValue.sol";
import "./SafeOwnable.sol";

contract FixedUintValue is IFixedUintValue, SafeOwnable {
  uint256 private _value;

  function set(uint256 value) external override onlyOwner {
    _value = value;
    emit ValueChange(value);
  }

  function get() external view override returns (uint256) {
    return _value;
  }
}

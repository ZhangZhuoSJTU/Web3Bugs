// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "prepo-shared-contracts/contracts/interfaces/IUintValue.sol";

contract TestUintValue is IUintValue {
  uint256 private _value;

  function setValue(uint256 value) public {
    _value = value;
  }

  function get() public view override returns (uint256) {
    return _value;
  }
}

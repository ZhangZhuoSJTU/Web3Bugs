// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

contract DeadToken {
  uint8 private _decimals = 18;

  function decimals() public view returns (uint8) {
    return _decimals;
  }
}

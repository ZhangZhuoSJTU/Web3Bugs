// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IUintValue.sol";

interface IFixedUintValue is IUintValue {
  event ValueChange(uint256 value);

  function set(uint256 value) external;
}

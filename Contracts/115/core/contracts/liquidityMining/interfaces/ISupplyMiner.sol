// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

interface ISupplyMiner {
  function baseDebtChanged(address user, uint256 newBaseDebt) external;
}

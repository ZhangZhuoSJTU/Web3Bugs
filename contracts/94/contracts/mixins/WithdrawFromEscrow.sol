// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../mixins/roles/AdminRole.sol";

import "../interfaces/ISendValueWithFallbackWithdraw.sol";

/**
 * @title Recovers funds in escrow.
 * @notice Allows recovery of funds that were not successfully transferred directly by the market.
 */
abstract contract WithdrawFromEscrow is AdminRole {
  /**
   * @notice Allows an admin to withdraw funds in the market escrow.
   * @dev This only applies when funds were unable to send, such as due to an out of gas error.
   * @param market The address of the contract to withdraw from.
   */
  function withdrawFromEscrow(ISendValueWithFallbackWithdraw market) external onlyAdmin {
    market.withdraw();
  }
}

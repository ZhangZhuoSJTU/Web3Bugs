// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

/**
 * @notice Attempt to send ETH and if the transfer fails or runs out of gas, store the balance
 * for future withdrawal instead.
 */
interface ISendValueWithFallbackWithdraw {
  /**
   * @notice Allows a user to manually withdraw funds which originally failed to transfer.
   */
  function withdraw() external;
}

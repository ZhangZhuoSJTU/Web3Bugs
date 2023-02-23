// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./ITokenSender.sol";

/**
 * @notice Module for storing a treasury address and an external
 * `ITokenSender` contract to send tokens to users based on some criteria.
 * @dev Typically used by a hook that sends a fee to `_treasury` and
 * reimburses it with a token using `_tokenSender`.
 */
interface ITokenSenderCaller {
  /**
   * @dev Emitted by `setTreasury()`.
   * @param treasury The new treasury address
   */
  event TreasuryChange(address treasury);

  /**
   * @dev Emitted by `setTokenSender()`.
   * @param tokenSender The new `ITokenSender` contract
   */
  event TokenSenderChange(address tokenSender);

  /**
   * @notice Sets the treasury address.
   * @dev This function is meant to be overriden and does not include any
   * access controls.
   * @param treasury The new treasury address
   */
  function setTreasury(address treasury) external;

  /**
   * @notice Sets the token sender contract.
   * @dev This function is meant to be overriden and does not include any
   * access controls.
   * @param tokenSender The new external token sender contract
   */
  function setTokenSender(ITokenSender tokenSender) external;

  /// @return The treasury address
  function getTreasury() external view returns (address);

  /// @return The external token sender contract
  function getTokenSender() external returns (ITokenSender);
}

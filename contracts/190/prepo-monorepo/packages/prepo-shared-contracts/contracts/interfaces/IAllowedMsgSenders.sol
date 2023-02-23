// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IAccountList.sol";

/**
 * @notice Module for storing an allowlist to restrict who can call certain
 * functions. Used throughout in our contracts for hooks or external contracts
 * that should only be read/write to by hooks.
 *
 * @dev `allowedMsgSenders` is private to be explicit about the list only
 * being usable through the `onlyAllowedMsgSenders` modifier.
 */
interface IAllowedMsgSenders {
  /**
   * @dev Emitted by `setAllowedMsgSenders()`.
   * @param allowedMsgSenders The new list representing allowed `msg.sender`s
   */
  event AllowedMsgSendersChange(IAccountList allowedMsgSenders);

  /**
   * @notice Sets the list that the `onlyAllowedMsgSenders` modifier will use
   * to restrict access.
   * @dev This function is meant to be overriden and does not include any
   * access controls.
   * @param allowedMsgSenders The new list representing allowed `msg.sender`s
   */
  function setAllowedMsgSenders(IAccountList allowedMsgSenders) external;

  /// @return The list representing allowed `msg.sender`'s
  function getAllowedMsgSenders() external view returns (IAccountList);
}

// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IDepositRecordHook.sol";

/**
 * @notice Top layer interface for `DepositHook`, not including modules
 * imported from our shared contracts. Adds on pausability for deposits.
 */
interface IDepositHook is IDepositRecordHook {
  /**
   * @dev Emitted via `setDepositsAllowed()`.
   * @param allowed Whether deposits are allowed or not
   */
  event DepositsAllowedChange(bool allowed);

  /**
   * @notice Sets whether deposits are allowed or not.
   * @param allowed Whether deposits will be allowed or not
   */
  function setDepositsAllowed(bool allowed) external;

  /// @return Whether deposits are allowed or not
  function depositsAllowed() external view returns (bool);
}

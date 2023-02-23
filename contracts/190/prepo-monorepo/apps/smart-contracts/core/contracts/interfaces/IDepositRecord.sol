// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

// TODO interface copy needs some further edits to reflect new implementation

/**
 * @notice Keeps track of global and per-user deposit totals. These totals
 * are used to enforce caps on the amount a user can deposit.
 */
interface IDepositRecord {
  /**
   * @dev Emitted via `setGlobalNetDepositCap()`.
   * @param cap New global deposit cap (net of withdrawals)
   */
  event GlobalNetDepositCapChange(uint256 cap);

  /**
   * @dev Emitted via `setUserDepositCap()`.
   * @param cap New user deposit cap
   */
  event UserDepositCapChange(uint256 cap);

  /**
   * @dev Emitted via `setAllowedHook()`.
   * @param hook Hook with changed permissions
   * @param allowed Whether the hook is allowed
   */
  event AllowedHooksChange(address hook, bool allowed);

  /**
   * @notice Adds `amount` to both the global and `sender`'s deposit totals.
   * @dev Reverts if the incoming deposit brings either total over their
   * respective caps.
   *
   * Only callable by allowed hooks.
   * @param sender The account making the deposit
   * @param amount The amount actually deposited by the user
   */
  function recordDeposit(address sender, uint256 amount) external;

  /**
   * @notice Subtracts `amount` from the global deposit total. Does not deduct
   * from `msg.sender`'s deposit total.
   *
   * Only callable by allowed hooks.
   * @param amount The amount actually withdrawn by the user
   */
  function recordWithdrawal(uint256 amount) external;

  /**
   * @notice Sets the global net deposit cap.
   * @dev Only callable by owner().
   * @param newGlobalNetDepositCap The new global net deposit cap
   */
  function setGlobalNetDepositCap(uint256 newGlobalNetDepositCap) external;

  /**
   * @notice Sets the cap on Base Token deposits per user. User deposit caps
   * are not calculated in a net fashion, unlike global caps.
   * @dev Only callable by owner().
   * @param newUserDepositCap The new account deposit cap
   */
  function setUserDepositCap(uint256 newUserDepositCap) external;

  /**
   * @notice Sets if a contract is allowed to record deposits
   * and withdrawals.
   * @dev Only callable by owner().
   * @param hook The contract address
   * @param allowed Whether or not the contract will be allowed
   */
  function setAllowedHook(address hook, bool allowed) external;

  /**
   * @notice Gets the maximum Base Token amount that is allowed to be
   * deposited (net of withdrawals).
   * @dev Deposits are not allowed if `globalNetDepositAmount` exceeds
   * the `globalNetDepositCap`.
   * @return The cap on global Base Token deposits (net of withdrawals)
   */
  function getGlobalNetDepositCap() external view returns (uint256);

  /// @return Net total of Base Token deposited.
  function getGlobalNetDepositAmount() external view returns (uint256);

  /**
   * @notice Gets the maximum Base Token amount that a user can deposit.
   * @return The cap on Base Token deposits per user
   */
  function getUserDepositCap() external view returns (uint256);

  /**
   * @param account The account to retrieve total deposits for
   * @return The total amount of Base Token deposited by a user
   */
  function getUserDepositAmount(address account) external view returns (uint256);

  /**
   * @notice Returns whether the contract is allowed to record deposits and
   * withdrawals.
   * @param hook The contract to retrieve allowed status for
   * @return Whether the contract is allowed
   */
  function isHookAllowed(address hook) external view returns (bool);
}

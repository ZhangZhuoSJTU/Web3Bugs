// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IDepositRecordHook.sol";

/**
 * @notice Top layer interface for `WithdrawHook`, not including modules
 * imported from our shared contracts. Adds on pausability and period-based
 * withdraw limits.
 */
interface IWithdrawHook is IDepositRecordHook {

  /**
   * @dev Emitted via `setWithdrawalsAllowed()`.
   * @param allowed Whether withdrawals are allowed or not
   */
  event WithdrawalsAllowedChange(bool allowed);

  /**
   * @dev Emitted via `setGlobalPeriodLength()`
   * @param period The new period for global withdraw limits
   */
  event GlobalPeriodLengthChange(uint256 period);

  /**
   * @dev Emitted via `setUserPeriodLength()`
   * @param period The new period for user-specific withdraw limits
   */
  event UserPeriodLengthChange(uint256 period);

  /**
   * @dev Emitted via `setGlobalWithdrawLimitPerPeriod()`
   * @param limit The new global withdraw limit per period
   */
  event GlobalWithdrawLimitPerPeriodChange(uint256 limit);

  /**
   * @dev Emitted via `setUserWithdrawLimitPerPeriod()`
   * @param limit The new user withdraw limit per period
   */
  event UserWithdrawLimitPerPeriodChange(uint256 limit);

  /**
   * @notice Sets whether withdrawals are allowed or not.
   * @dev Only callable by `SET_WITHDRAWALS_ALLOWED_ROLE` role holder.
   * @param newWithdrawalsAllowed Whether withdrawals will be allowed or not
   */
  function setWithdrawalsAllowed(bool newWithdrawalsAllowed) external;

  /**
   * @notice Sets the length in seconds for which global withdraw limits will
   * be evaluated against. Every time `globalPeriodLength` seconds passes, the
   * global amount withdrawn will be reset to 0. This amount is only recorded
   * for the purposes of enforcing global withdrawal limits.
   * @dev Only callable by `SET_GLOBAL_PERIOD_LENGTH_ROLE` role holder.
   *
   * If the global period changes while an existing period is ongoing, the
   * new period will immediately go into effect. Whether to reset will be
   * evaluated based on the last time a reset occurred and the new period.
   * @param newGlobalPeriodLength Length in seconds of the new global period
   */
  function setGlobalPeriodLength(uint256 newGlobalPeriodLength) external;

  /**
   * @notice Sets the length in seconds for which user withdraw limits will
   * be evaluated against. Every time `userPeriodLength` seconds passes, the
   * amount withdrawn for all users will be reset to 0. This amount is only
   * recorded for the purposes of enforcing user withdrawal limits.
   * @dev Only callable by `SET_USER_PERIOD_LENGTH_ROLE` role holder.
   *
   * If the user period changes while an existing period is ongoing, the
   * new period will immediately go into effect. Whether to reset will be
   * evaluated based on the last time a reset occurred and the new period.
   * @param newUserPeriodLength Length in seconds of the new user period
   */
  function setUserPeriodLength(uint256 newUserPeriodLength) external;

  /**
   * @notice Sets the Collateral amount that withdrawal totals, globally,
   * cannot exceed during a period.
   * @dev Only callable by `SET_GLOBAL_WITHDRAW_LIMIT_PER_PERIOD_ROLE` role
   * holder.
   *
   * If the global withdraw limit changes, the global total will be
   * assessed based on the new limit.
   * @param newGlobalWithdrawLimitPerPeriod The new global limit in Collateral
   */
  function setGlobalWithdrawLimitPerPeriod(uint256 newGlobalWithdrawLimitPerPeriod) external;

  /**
   * @notice Sets the Collateral amount that withdrawal totals, for an
   * individual account, cannot exceed during a period.
   * @dev Only callable by `SET_USER_WITHDRAW_LIMIT_PER_PERIOD_ROLE` role
   * holder.
   *
   * If the user withdraw limit changes, account totals will be assessed based
   * on the new limit.
   * @param newUserWithdrawLimitPerPeriod The new user limit in Collateral
   */
  function setUserWithdrawLimitPerPeriod(uint256 newUserWithdrawLimitPerPeriod) external;

  /// @return Whether withdrawals are allowed
  function withdrawalsAllowed() external view returns (bool);

  /// @return The global period in seconds
  function getGlobalPeriodLength() external view returns (uint256);

  /// @return The user period in seconds
  function getUserPeriodLength() external view returns (uint256);

  /// @return The global withdraw limit that cannot be exceeded for a period
  function getGlobalWithdrawLimitPerPeriod() external view returns (uint256);

  /// @return The user withdraw limit that cannot be exceeded for a period
  function getUserWithdrawLimitPerPeriod() external view returns (uint256);

  /// @return The last time the global amount withdrawn this period was reset
  function getLastGlobalPeriodReset() external view returns (uint256);

  /// @return The last time user amounts withdrawn this period were reset
  function getLastUserPeriodReset() external view returns (uint256);

  /// @return The global amount withdrawn for the current period
  function getGlobalAmountWithdrawnThisPeriod() external view returns (uint256);

  /**
   * @param user Account the withdrawal total belongs to
   * @return The amount withdrawn by `user` for the current period
   */
  function getAmountWithdrawnThisPeriod(address user) external view returns (uint256);
}

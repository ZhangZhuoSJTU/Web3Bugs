// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IDepositRecordHook.sol";

/**
 * @notice Top layer interface for `ManagerWithdrawHook`, not including modules
 * imported from our shared contracts. Adds on enforcement of minimum reserve
 * requirements.
 */
interface IManagerWithdrawHook is IDepositRecordHook {
  /**
   * @dev Emitted via `setMinReservePercentage()`.
   * @param percentage The new minimum required reserve percentage
   */
  event MinReservePercentageChange(uint256 percentage);

  /**
   * @notice Sets the minimum percentage of global Base Token deposits that
   * must remain within the collateral contract.
   *
   * Must be a 4 decimal place percentage value e.g. 4.9999% = 49999.
   */
  function setMinReservePercentage(uint256 newMinReservePercentage) external;

  /// @return The minimum required reserve percentage
  function getMinReservePercentage() external view returns (uint256);

  /**
   * @notice Based on the current global deposit total, returns the
   * minimum amount of Base Token that must be kept within the collateral
   * contract.
   * @dev The global deposit total is polled from the same `depositRecord`
   * contract that the Collateral contract records deposits/withdrawals to.
   * @return The amount that must reside within the contract
   */
  function getMinReserve() external view returns (uint256);
}

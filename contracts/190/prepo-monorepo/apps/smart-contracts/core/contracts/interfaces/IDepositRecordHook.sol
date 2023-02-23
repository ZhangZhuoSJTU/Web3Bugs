// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./ICollateralHook.sol";
import "./IDepositRecord.sol";

/**
 * @notice An interface layer for `ICollateralHook` hooks that need to
 * read/write to a deposit record.
 */
interface IDepositRecordHook is ICollateralHook {
  /**
   * @dev Emitted via `setDepositRecord()`.
   * @param depositRecord Address of the new deposit record
   */
  event DepositRecordChange(address depositRecord);

  /**
   * @notice Sets the external `IDepositRecord` contract for a hook to
   * read/write to.
   * @dev Only callable by `SET_DEPOSIT_RECORD_ROLE` role holder
   * @param newDepositRecord Address of the new deposit record
   */
  function setDepositRecord(IDepositRecord newDepositRecord) external;

  /// @return The deposit record contract
  function getDepositRecord() external view returns (IDepositRecord);
}

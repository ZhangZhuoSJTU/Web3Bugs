// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IAccountList.sol";

/**
 * @notice Module for storing an external list of accounts for a contract to
 * use.
 */
interface IAccountListCaller {
  /**
   * @dev Emitted by `setAccountList()`.
   * @param accountList The new external list
   */
  event AccountListChange(IAccountList accountList);

  /**
   * @notice Sets the external list.
   * @dev This function is meant to be overriden and does not include any
   * access controls.
   * @param accountList The new external list
   */
  function setAccountList(IAccountList accountList) external;

  /// @return The external list
  function getAccountList() external view returns (IAccountList);
}

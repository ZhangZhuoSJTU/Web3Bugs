// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IPurchaseHook.sol";
import "prepo-shared-contracts/contracts/interfaces/IAccountList.sol";

/**
 * @notice Hook that provides allowlist functionality for a `MiniSales`
 * purchase. Only allowed addresses can participate in a sale with this hook
 * enabled.
 */
interface IAllowlistPurchaseHook is IPurchaseHook {
  /**
   * @dev Emitted via `setAllowlist()`.
   * @param newAllowlist Address of the new allowlist
   */
  event AccountListChange(IAccountList newAllowlist);

  /**
   * @notice Sets the allowlist containing addresses that are allowed to
   * purchase.
   * @dev Only callable by `owner()`.
   * @param newAllowlist Address of the new allowlist
   */
  function setAllowlist(IAccountList newAllowlist) external;

  /// @return The allowlist contract
  function getAllowlist() external view returns (IAccountList);
}

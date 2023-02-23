// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./ITransferHook.sol";
import "prepo-shared-contracts/contracts/interfaces/IAccountList.sol";

/**
 * @notice Hook that provides blocklist functionality for token transfers.
 * A blocked address cannot send or receive the specified ERC20 token.
 */
interface IBlocklistTransferHook is ITransferHook {
  /**
   * @dev Emitted via `setBlocklist()`.
   * @param newBlocklist Address of the `IAccountList` contract
   */
  event BlocklistChange(IAccountList newBlocklist);

  /**
   * @notice Sets the `IAccountList` contract that specifies the addresses to
   * block.
   * @param newBlocklist Address of the `IAccountList` contract
   */
  function setBlocklist(IAccountList newBlocklist) external;

  ///@return The blocklist contract
  function getBlocklist() external view returns (IAccountList);
}

// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

///@notice External hook to be called before or after an ERC20 token transfer.
interface ITransferHook {
  /**
   * @notice A generic hook function, to be called before or after a token
   * transfer.
   * @dev This function should reside in an ERC20's `_beforeTokenTransfer()`
   * or `_afterTokenTransfer()` internal functions.
   * @param from Address tokens are coming from
   * @param to Address tokens are going to
   * @param amount Token amount being transferred
   */
  function hook(
    address from,
    address to,
    uint256 amount
  ) external;
}

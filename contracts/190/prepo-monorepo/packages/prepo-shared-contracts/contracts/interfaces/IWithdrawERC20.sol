// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice Allows a contract owner to withdraw any ERC20 tokens residing
 * within the contract to themselves.
 */
interface IWithdrawERC20 {
  /**
   * @notice Withdraws corresponding `amounts` of each ERC20 in `erc20Tokens`.
   * @dev Length of `erc20Tokens` and `amounts` must match.
   *
   * Only callable by `owner()`.
   * @param erc20Tokens ERC20 tokens to be withdrawn
   * @param amounts Amounts to be withdrawn
   */
  function withdrawERC20(address[] calldata erc20Tokens, uint256[] calldata amounts) external;

  /**
   * @notice Withdraws entire balance of each ERC20 in `erc20Tokens`.
   * @dev Only callable by `owner()`.
   * @param erc20Tokens ERC20 tokens to be withdrawn
   */
  function withdrawERC20(address[] calldata erc20Tokens) external;
}

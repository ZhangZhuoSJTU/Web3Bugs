// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @notice Allows a contract owner to withdraw any ERC1155s residing
 * within the contract to destinations of their choosing.
 */
interface IWithdrawERC1155 {
  /**
   * @notice Withdraws corresponding `amounts` of `ids` of each ERC1155 in
   * `erc1155Tokens` and sends them to their respective addresses in
   * `recipients`.
   * @dev Length of `erc1155Tokens`, `recipients`, `ids`, `amounts` must
   * match.
   *
   * Only callable by `owner()`.
   * @param erc1155Tokens ERC1155 tokens to be withdrawn
   * @param recipients Addresses to send tokens to
   * @param ids IDs of tokens to be withdrawn
   * @param amounts Amount of each token to be withdrawn
   */
  function withdrawERC1155(
    address[] calldata erc1155Tokens,
    address[] calldata recipients,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external;
}

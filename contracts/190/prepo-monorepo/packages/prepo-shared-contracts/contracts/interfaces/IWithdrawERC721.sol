// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @notice Allows a contract owner to withdraw any ERC721s residing
 * within the contract to destinations of their choosing.
 */
interface IWithdrawERC721 {
  /**
   * @notice Withdraws corresponding `ids` of each ERC721 in `erc721Tokens`
   * and sends them to their respective address in `recipients`.
   * @dev Length of `erc721Tokens`, `recipients` and `ids` must match.
   *
   * Only callable by `owner()`.
   * @param erc721Tokens ERC721 tokens to be withdrawn
   * @param recipients Addresses to send tokens to
   * @param ids IDs of tokens to be withdrawn
   */
  function withdrawERC721(
    address[] calldata erc721Tokens,
    address[] calldata recipients,
    uint256[] calldata ids
  ) external;
}

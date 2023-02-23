// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./ITokenShop.sol";

/**
 * @notice Hook to be called when a user makes a `TokenShop` purchase.
 * @dev A different hook is called based on whether a buyer is purchasing a
 * ERC721 or ERC1155 token.
 */
interface IPurchaseHook {
  /**
   * @notice A hook called for each ERC721 token a user purchases.
   * @dev Limits the amount of a certain token a user can purchase.
   * @param user Address of buyer
   * @param tokenContract ERC721 contract of the token to be bought
   * @param tokenId ID of the token to be bought
   */
  function hookERC721(
    address user,
    address tokenContract,
    uint256 tokenId
  ) external;

  /**
   * @notice A hook called for each ERC1155 token a user purchases.
   * @dev Limits the amount of a certain token a user can purchase.
   * @param user Address of buyer
   * @param tokenContract ERC1155 contract of the token to be bought
   * @param tokenId Token ID to be bought
   * @param amount Amount of token to be bought
   */
  function hookERC1155(
    address user,
    address tokenContract,
    uint256 tokenId,
    uint256 amount
  ) external;

  //TODO: move this into a sub-interface
  /**
   * @notice Sets the limit on purchases for each token, based on
   * corresponding `amounts` of each ERC721 in `contracts`.
   * @dev A limit of 0 allows users to buy unlimited amounts of a token.
   * @param contracts ERC721s a purchase limit is to be set for
   * @param amounts Purchase limits to be set
   */
  function setMaxERC721PurchasesPerUser(
    address[] memory contracts,
    uint256[] memory amounts
  ) external;

  /**
   * @notice Sets the limit on purchases for each token, based on
   * corresponding `amounts` of each ERC1155 in `contracts`.
   * @dev A limit of 0 allows users to buy unlimited amounts of a token.
   * @param contracts ERC1155s a purchase limit is to be set for
   * @param ids Token IDs a purchase limit is to be set for
   * @param amounts Purchase limits to be set
   */
  function setMaxERC1155PurchasesPerUser(
    address[] memory contracts,
    uint256[] memory ids,
    uint256[] memory amounts
  ) external;

  /**
   * @notice Sets the TokenShop contract that will be allowed to call hooks.
   * @param newTokenShop Address of the new TokenShop contract
   */
  function setTokenShop(address newTokenShop) external;

  /**
   * @param tokenContract The ERC721 contract
   * @return Limit on the amount of `tokenContract` tokens a user can buy
   */
  function getMaxERC721PurchasesPerUser(address tokenContract)
    external
    view
    returns (uint256);

  /**
   * @param tokenContract The ERC1155 contract
   * @param id The ERC1155 token ID
   * @return Limit on the amount of `id` of `tokenContract` a user can buy
   */
  function getMaxERC1155PurchasesPerUser(address tokenContract, uint256 id)
    external
    view
    returns (uint256);

  /// @return The TokenShop contract
  function getTokenShop() external view returns (ITokenShop);
}

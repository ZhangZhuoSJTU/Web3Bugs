// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./IPurchaseHook.sol";

/**
 * @notice Makes ERC721 and ERC1155 tokens avaiable for purchase in exchange
 * for a set payment token.
 */
interface ITokenShop {
  /**
   * @notice Sets prices for corresponding `ids` of each ERC721/1155 in
   * `tokenContracts` from `prices`.
   * @dev Only callable by `owner()`.
   * @param tokenContracts ERC721/1155s to be listed
   * @param ids Token IDs to be listed
   * @param prices Price of each ERC721/1155 in payment token
   */
  function setContractToIdToPrice(
    address[] memory tokenContracts,
    uint256[] memory ids,
    uint256[] memory prices
  ) external;

  /**
   * @notice Sets the purchase hook to be called during a purchase.
   * @dev Only callable by `owner()`.
   * @param newPurchaseHook Address of the new purchase hook
   */
  function setPurchaseHook(address newPurchaseHook) external;

  /**
   * @notice Purchases corresponding `amounts` of `ids` of each ERC721/1155
   * in `tokenContracts` for their listed price.
   * @dev `amounts` entries for ERC721s can be left as 0 since they will be
   * ignored.
   * @param tokenContracts ERC721/1155s to be purchased
   * @param ids Token IDs to be purchased
   * @param amounts Amounts to be purchased
   * @param purchasePrices Purchase price of each ERC721/1155 in payment token
   */
  function purchase(
    address[] memory tokenContracts,
    uint256[] memory ids,
    uint256[] memory amounts,
    uint256[] memory purchasePrices
  ) external;

  /**
   * @param tokenContract The ERC721/1155 contract
   * @param id The ERC721/1155 token ID
   * @return Price of `id` in `tokenContract` in payment token
   */
  function getPrice(address tokenContract, uint256 id)
    external
    view
    returns (uint256);

  /// @return ERC20 token that is accepted as payment
  function getPaymentToken() external view returns (address);

  /// @return The purchase hook contract
  function getPurchaseHook() external view returns (IPurchaseHook);

  /**
   * @param user The address to retrieve data for
   * @param tokenContract The ERC721 contract
   * @return Amount of `tokenContract` tokens that `user` has purchased
   */
  function getERC721PurchaseCount(address user, address tokenContract)
    external
    view
    returns (uint256);

  /**
   * @param user The address to retrieve data for
   * @param tokenContract The ERC1155 contract
   * @param id The ERC1155 token ID
   * @return Amount of `id` of `tokenContract` that `user` has purchased
   */
  function getERC1155PurchaseCount(
    address user,
    address tokenContract,
    uint256 id
  ) external view returns (uint256);
}

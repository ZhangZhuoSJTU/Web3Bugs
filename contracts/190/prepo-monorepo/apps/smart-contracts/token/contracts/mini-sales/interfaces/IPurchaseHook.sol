// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice Hook to be called when a user makes a `MiniSales` purchase.
 * @dev A hook could contain purchase restriction logic and/or update
 * auxiliary data.
 */
interface IPurchaseHook {
  /**
   * @notice Hook to be called when a user makes a `MiniSales` purchase.
   * @param purchaser Address that payment token was taken from
   * @param recipient Address that sale token was delivered to
   * @param amount Amount of sale token purchased
   * @param price Sale token price in terms of payment token
   * @param data Data payload for supporting additional hook functionality
   */
  function hook(
    address purchaser,
    address recipient,
    uint256 amount,
    uint256 price,
    bytes calldata data
  ) external;
}

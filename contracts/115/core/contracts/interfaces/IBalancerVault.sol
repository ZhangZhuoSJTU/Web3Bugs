// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IBalancerVault {
  enum PoolSpecialization { GENERAL, MINIMAL_SWAP_INFO, TWO_TOKEN }

  /**
   * @dev Returns a Pool's contract address and specialization setting.
   */
  function getPool(bytes32 poolId) external view returns (address, PoolSpecialization);

  /**
   * @dev Returns a Pool's registered tokens, the total balance for each, and the latest block when *any* of
   * the tokens' `balances` changed.
   *
   * The order of the `tokens` array is the same order that will be used in `joinPool`, `exitPool`, as well as in all
   * Pool hooks (where applicable). Calls to `registerTokens` and `deregisterTokens` may change this order.
   *
   * If a Pool only registers tokens once, and these are sorted in ascending order, they will be stored in the same
   * order as passed to `registerTokens`.
   *
   * Total balances include both tokens held by the Vault and those withdrawn by the Pool's Asset Managers. These are
   * the amounts used by joins, exits and swaps. For a detailed breakdown of token balances, use `getPoolTokenInfo`
   * instead.
   */
  function getPoolTokens(bytes32 poolId)
    external
    view
    returns (
      address[] memory tokens,
      uint256[] memory balances,
      uint256 lastChangeBlock
    );
}

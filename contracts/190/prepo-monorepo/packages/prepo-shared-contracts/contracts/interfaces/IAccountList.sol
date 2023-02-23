// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice Stores whether an address is included in a set.
 */
interface IAccountList {
  /**
   * @notice Sets whether an address in `accounts` is included.
   * @dev Whether an account is included is based on the boolean value at its
   * respective index in `included`. This function will only edit the
   * inclusion of addresses in `accounts`.
   *
   * The length of `accounts` and `included` must match.
   *
   * Only callable by `owner()`.
   * @param accounts Addresses to change inclusion for
   * @param included Whether to include corresponding address in `accounts`
   */
  function set(address[] calldata accounts, bool[] calldata included) external;

  /**
   * @notice Removes every address from the set. Atomically includes any
   * addresses in `newIncludedAccounts`.
   * @dev Only callable by `owner()`.
   * @param newIncludedAccounts Addresses to include after reset
   */
  function reset(address[] calldata newIncludedAccounts) external;

  /**
   * @param account Address to check inclusion for
   * @return Whether `account` is included
   */
  function isIncluded(address account) external view returns (bool);
}

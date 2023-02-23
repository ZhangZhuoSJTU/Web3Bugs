// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice This contract enables inheriting contracts to accept, transfer and
 * renounce ownership of any SafeOwnable contract.
 * @dev All non-view methods must be overridden in the inheriting contract
 * with suitable access controls to prevent anyone from calling them.
 */
interface ISafeOwnableCaller {
  /**
   * @notice Nominates an address to be owner of the SafeOwnable contract.
   * @dev Only callable by `owner()` of the contract.
   * @param safeOwnableContract Address of the SafeOwnable contract for which
   * nominee is to be set
   * @param nominee The address that will be nominated
   */
  function transferOwnership(address safeOwnableContract, address nominee) external;

  /**
   * @notice Accepts ownership nomination of the SafeOwnable contract.
   * @dev Only callable by the current nominee of the contract.
   * Sets nominee of the contract back to zero address.
   * @param safeOwnableContract Address of the SafeOwnable contract for which
   * nominee is to be set
   */
  function acceptOwnership(address safeOwnableContract) external;

  /**
   * @notice Renounces ownership nomination of the SafeOwnable contract and
   * leaves the contract without any owner.
   * @dev Only callable by `owner()` of the contract.
   * Sets nominee of the contract back to zero address.
   * It will not be possible to call `onlyOwner` functions of the SafeOwnable
   * contract anymore.
   * @param safeOwnableContract Address of the SafeOwnable contract for which
   * nominee is to be set
   */
  function renounceOwnership(address safeOwnableContract) external;
}

// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice Allows a contract owner to pause their contract.
 * @dev Pausing a contract will only affect functions using the included
 * `whenNotPaused` modifier.
 */
interface IPausable {
  /**
   * @dev Emitted by `setPaused()`.
   * @param newPaused Whether the contract was paused
   */
  event PausedChange(bool newPaused);

  /**
   * @notice Pauses or unpauses the contract.
   * @dev Only callable by `owner()`.
   * @param newPaused Whether the contract is to be paused
   */
  function setPaused(bool newPaused) external;

  /// @return Whether the contract is currently paused
  function isPaused() external view returns (bool);
}

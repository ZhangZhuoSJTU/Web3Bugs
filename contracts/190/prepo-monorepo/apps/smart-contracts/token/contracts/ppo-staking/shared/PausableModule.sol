// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {ImmutableModule} from "./ImmutableModule.sol";

/**
 * @title   PausableModule
 * @author  mStable
 * @dev     Forked from @openzeppelin/contracts/lifecycle/pausable
 *          Changes: `onlyGovernor` can pause
 */
abstract contract PausableModule is ImmutableModule {
  /**
   * @dev Emitted when the pause is triggered by Governor
   */
  event Paused(address account);

  /**
   * @dev Emitted when the pause is lifted by Governor
   */
  event Unpaused(address account);

  bool internal _paused = false;

  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    require(!_paused, "Pausable: paused");
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    require(_paused, "Pausable: not paused");
    _;
  }

  /**
   * @dev Initializes the contract in unpaused state.
   * Hooks into the Module to give the Governor ability to pause
   * @param _nexus Nexus contract address
   */
  constructor(address _nexus) ImmutableModule(_nexus) {
    _paused = false;
  }

  /**
   * @dev Returns true if the contract is paused, and false otherwise.
   * @return Returns `true` when paused, otherwise `false`
   */
  function paused() external view returns (bool) {
    return _paused;
  }

  /**
   * @dev Called by the Governor to pause, triggers stopped state.
   */
  function pause() external onlyGovernor whenNotPaused {
    _paused = true;
    emit Paused(msg.sender);
  }

  /**
   * @dev Called by Governor to unpause, returns to normal state.
   */
  function unpause() external onlyGovernor whenPaused {
    _paused = false;
    emit Unpaused(msg.sender);
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @title   InitializableModuleKeysStorage
 * @author  mStable
 * @notice  Used to preserve storage slots for proxy contracts that
 *          used InitializableModuleKeys but are now using ImmutableModule
 *          which uses immutable variables rather than contract storage.
 * @dev     VERSION: 1.0
 *          DATE:    2021-05-27
 */
contract ModuleKeysStorage {
  // Deprecated stotage variables, but kept around to mirror storage layout
  bytes32 private DEPRECATED_KEY_GOVERNANCE;
  bytes32 private DEPRECATED_KEY_STAKING;
  bytes32 private DEPRECATED_KEY_PROXY_ADMIN;
  bytes32 private DEPRECATED_KEY_ORACLE_HUB;
  bytes32 private DEPRECATED_KEY_MANAGER;
  bytes32 private DEPRECATED_KEY_RECOLLATERALISER;
  bytes32 private DEPRECATED_KEY_META_TOKEN;
  bytes32 private DEPRECATED_KEY_SAVINGS_MANAGER;
}

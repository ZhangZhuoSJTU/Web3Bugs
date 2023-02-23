// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @notice  Is only used in the upgrade of mUSD from V2.0 to V3.0.
            This contract preserves the V2.0 storage positions in
            the new V3.0 Masset contract.
 * @author  mStable
 * @dev     VERSION: 3.0
 *          DATE:    2021-02-23
 */
contract InitializableModuleKeysV1 {
  // Governance                             // Phases
  bytes32 private KEY_GOVERNANCE_DEPRICATED; // 2.x
  bytes32 private KEY_STAKING_DEPRICATED; // 1.2
  bytes32 private KEY_PROXY_ADMIN_DEPRICATED; // 1.0

  // mStable
  bytes32 private KEY_ORACLE_HUB_DEPRICATED; // 1.2
  bytes32 private KEY_MANAGER_DEPRICATED; // 1.2
  bytes32 private KEY_RECOLLATERALISER_DEPRICATED; // 2.x
  bytes32 private KEY_META_TOKEN_DEPRICATED; // 1.1
  bytes32 private KEY_SAVINGS_MANAGER_DEPRICATED; // 1.0
}

contract InitializableModuleV1 is InitializableModuleKeysV1 {
  address private nexus_depricated;
}

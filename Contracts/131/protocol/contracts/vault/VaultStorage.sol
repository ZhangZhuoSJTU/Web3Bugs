// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../libraries/EnumerableMapping.sol";
import "../../interfaces/IVaultReserve.sol";
import "../../interfaces/strategies/IStrategy.sol";

contract VaultStorage {
    uint256 public currentAllocated;
    uint256 public waitingForRemovalAllocated;
    address public pool;

    uint256 public totalDebt;
    bool public strategyActive;

    EnumerableMapping.AddressToUintMap internal _strategiesWaitingForRemoval;
}

contract VaultStorageV1 is VaultStorage {
    /**
     * @dev This is to avoid breaking contracts inheriting from `VaultStorage`
     * such as `Erc20Vault`, especially if they have storage variables
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     * for more details
     *
     * A new field can be added using a new contract such as
     *
     * ```solidity
     * contract VaultStorageV2 is VaultStorage {
     *   uint256 someNewField;
     *   uint256[49] private __gap;
     * }
     */
    uint256[50] private __gap;
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

/**
 * Full contract can be found here: https://github.com/gnosis/delegate-registry/blob/main/contracts/DelegateRegistry.sol
 */

interface IDelegateRegistry {
    function setDelegate(bytes32 id, address delegate) external;

    function clearDelegate(bytes32 id) external;
}

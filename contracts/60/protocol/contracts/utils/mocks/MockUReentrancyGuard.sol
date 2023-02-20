// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../unstructured/UReentrancyGuard.sol";

contract MockUReentrancyGuard is UReentrancyGuard {
    bytes32 private constant STATUS_SLOT = keccak256("equilibria.utils.UReentrancyGuard.status");

    event NoOp();

    function __initialize() external {
        super.UReentrancyGuard__initialize();
    }

    function __status() external view returns (uint256 result) {
        bytes32 slot = STATUS_SLOT;
        assembly {
            result := sload(slot)
        }
    }

    function noReenter() nonReentrant public { emit NoOp(); }
    function reenterRecursive() nonReentrant public { reenterRecursive(); }
    function reenterDifferent() nonReentrant public { noReenter(); }
}

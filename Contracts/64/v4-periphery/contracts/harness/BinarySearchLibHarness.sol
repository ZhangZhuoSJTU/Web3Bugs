// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "../libraries/BinarySearchLib.sol";

contract BinarySearchLibHarness {
    using BinarySearchLib for uint32[];
    uint32[] internal history;

    function getIndex(uint32 id) external view returns (uint32) {
        return history.binarySearch(id);
    }

    function set(uint32[] calldata _history) external {
        history = _history;
    }
}

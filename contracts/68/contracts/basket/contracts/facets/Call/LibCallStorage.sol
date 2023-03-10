// SPDX-License-Identifier: MIT
pragma solidity ^0.7.5;

library LibCallStorage {
    bytes32 constant CALL_STORAGE_POSITION =
        keccak256("diamond.standard.call.storage");

    struct CallStorage {
        mapping(address => bool) canCall;
        address[] callers;
    }

    function callStorage() internal pure returns (CallStorage storage cs) {
        bytes32 position = CALL_STORAGE_POSITION;
        assembly {
            cs.slot := position
        }
    }
}

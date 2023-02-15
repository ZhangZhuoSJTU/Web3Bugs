// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

contract Beacon {
    address internal _implementation;
    address internal immutable _CONTROLLER;
    
    constructor(address impl) {
        _implementation = impl;
        _CONTROLLER = msg.sender;
    }
    
    fallback() external {
        if (msg.sender != _CONTROLLER) {
            // solhint-disable-next-line no-inline-assembly
          assembly {
            mstore(0, sload(0))
            return(0, 32)
          }
        } else {
            // solhint-disable-next-line no-inline-assembly
          assembly { sstore(0, calldataload(0)) }
        }
    }
}

//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ICoreFactory} from "../interfaces/ICoreFactory.sol";

contract CoreProxy is Ownable {
    address private immutable _implement;

    constructor(address _imp) {
        _implement = _imp;
    }

    fallback() external {
        address _impl = implement();
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), _impl, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)

            switch result
            case 0 {
                revert(ptr, size)
            }
            default {
                return(ptr, size)
            }
        }
    }

    function implement() public view returns (address) {
        return _implement;
    }
}

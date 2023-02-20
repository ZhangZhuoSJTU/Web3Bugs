// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {SplitStorage} from "./SplitStorage.sol";

interface ISplitFactory {
    function splitter() external returns (address);

    function splitAsset() external returns (address);

    function merkleRoot() external returns (bytes32);
}

/**
 * @title SplitProxy
 */
contract SplitProxy is SplitStorage {
    constructor() {
        _splitter = ISplitFactory(msg.sender).splitter();
        splitAsset = ISplitFactory(msg.sender).splitAsset();
        merkleRoot = ISplitFactory(msg.sender).merkleRoot();
    }

    fallback() external payable {
        address _impl = splitter();
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

    /**
     * @dev Returns the address of the splitter contract.
     * @return address
     */
    function splitter() public view returns (address) {
        return _splitter;
    }

    receive() external payable {}
}

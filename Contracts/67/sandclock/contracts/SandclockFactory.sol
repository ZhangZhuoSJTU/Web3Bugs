// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {Trust} from "@rari-capital/solmate/src/auth/Trust.sol";

contract SandclockFactory is Context, Trust {
    //
    // Events
    //

    event NewVault(address indexed vault, uint256 salt);
    event NewDCA(address indexed dca, uint256 salt);

    //
    // Constructor
    //

    constructor() Trust(_msgSender()) {}

    //
    // Public API
    //

    function deployVault(bytes memory code, uint256 salt)
        external
        requiresTrust
    {
        address addr = deploy(code, salt);

        emit NewVault(addr, salt);
    }

    function deployDCA(bytes memory code, uint256 salt) external requiresTrust {
        address addr = deploy(code, salt);

        emit NewDCA(addr, salt);
    }

    //
    // Internal
    //

    function deploy(bytes memory code, uint256 salt)
        internal
        returns (address)
    {
        address addr;
        assembly {
            addr := create2(0, add(code, 0x20), mload(code), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }

        return addr;
    }
}

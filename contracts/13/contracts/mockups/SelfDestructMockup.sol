// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "hardhat/console.sol";

// to test force sending Ether to Treasury

contract SelfDestructMockup {
    function killme(address payable _address) public {
        selfdestruct(_address);
    }

    receive() external payable {}
}

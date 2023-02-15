// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

contract Destructible {
    
    receive() external payable {}
    
    function destruct(address payable _receiver) external {
        selfdestruct(_receiver);
    }
}

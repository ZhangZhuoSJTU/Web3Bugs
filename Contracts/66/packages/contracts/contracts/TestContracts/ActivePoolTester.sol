// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseYUSDDebt(uint _amount) external {
        YUSDDebt  = YUSDDebt.add(_amount);
    }
    
    function unprotectedPayable() external payable {
        // @KingYet: Commented
        // ETH = ETH.add(msg.value);
    }
}
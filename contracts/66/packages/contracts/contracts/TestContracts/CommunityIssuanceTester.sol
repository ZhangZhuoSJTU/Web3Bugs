// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../YETI/CommunityIssuance.sol";

contract CommunityIssuanceTester is CommunityIssuance {
    function obtainYETI(uint _amount) external {
        yetiToken.transfer(msg.sender, _amount);
    }

    function getCumulativeIssuanceFraction() external view returns (uint) {
       return _getCumulativeIssuanceFraction();
    }

    function unprotectedIssueYETI() external returns (uint) {
        // No checks on caller address
       
        uint latestTotalYETIIssued = YETISupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalYETIIssued.sub(totalYETIIssued);
      
        totalYETIIssued = latestTotalYETIIssued;
        return issuance;
    }
}

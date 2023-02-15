// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

interface ICommunityIssuance { 
    
    // --- Events ---
    
    event YETITokenAddressSet(address _yetiTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalYETIIssuedUpdated(uint _totalYETIIssued);

    // --- Functions ---

    function setAddresses(address _yetiTokenAddress, address _stabilityPoolAddress) external;

    function issueYETI() external returns (uint);

    function sendYETI(address _account, uint _YETIamount) external;
}

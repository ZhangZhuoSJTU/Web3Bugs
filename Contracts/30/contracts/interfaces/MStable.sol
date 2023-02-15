// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface MStable {
    function mint(address, uint) external;
    function redeem(address, uint) external;
}

interface mSavings {
    function depositSavings(uint) external;
    function creditBalances(address) external view returns (uint);
    function redeem(uint) external;
    function exchangeRate() external view returns (uint);
}

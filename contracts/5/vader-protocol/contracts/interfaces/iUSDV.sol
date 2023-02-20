// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

interface iUSDV {
    function ROUTER() external view returns (address);
    function isMature() external view returns (bool);
    function setParams(uint newDelay) external;
    
    function convert(uint amount) external returns(uint convertAmount);
    function convertForMember(address member, uint amount) external returns(uint convertAmount);
    function redeem(uint amount) external returns(uint redeemAmount);
    function redeemForMember(address member, uint amount) external returns(uint redeemAmount);
}
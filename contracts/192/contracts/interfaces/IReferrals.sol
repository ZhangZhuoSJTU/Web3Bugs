// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IReferrals {

    function createReferralCode(bytes32 _hash) external;
    function setReferred(address _referredTrader, bytes32 _hash) external;
    function getReferred(address _trader) external view returns (bytes32);
    function getReferral(bytes32 _hash) external view returns (address);
    
}
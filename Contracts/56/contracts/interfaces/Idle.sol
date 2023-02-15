// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface IIdleTokenV3_1 {
    function tokenPrice() external view returns (uint256 price);
    function token() external view returns (address);
    function mintIdleToken(uint256 _amount, bool _skipRebalance, address _referral) external returns (uint256 mintedTokens);
    function redeemIdleToken(uint256 _amount) external returns (uint256 redeemedTokens);
}

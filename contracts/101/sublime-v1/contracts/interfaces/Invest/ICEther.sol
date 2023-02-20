// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface ICEther {
    function mint() external payable;

    function redeem(uint256 redeemTokens) external returns (uint256);

    function getCash() external returns (uint256);
}

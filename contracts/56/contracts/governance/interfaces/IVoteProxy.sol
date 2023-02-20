// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IVoteProxy {
    function decimals() external pure returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address _voter) external view returns (uint256);
}

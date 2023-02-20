// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IRewards {
    function balanceOf(address) external view returns (uint256);
    function earned(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

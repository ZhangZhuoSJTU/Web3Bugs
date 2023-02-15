// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IMasterChef {
    function userInfo(uint256, address) external view returns (uint256, uint256, uint256);
    function pendingYaxis(uint256, address) external view returns (uint256);
}

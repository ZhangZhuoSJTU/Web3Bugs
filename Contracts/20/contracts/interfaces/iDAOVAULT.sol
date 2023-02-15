// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
interface iDAOVAULT{
function getMemberWeight(address) external view returns (uint256);
function depositLP(address, uint, address) external;
function withdraw(address, address) external returns (bool);
function totalWeight() external view returns (uint);
}
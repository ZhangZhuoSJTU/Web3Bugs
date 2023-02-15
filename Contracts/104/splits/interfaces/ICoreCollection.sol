// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ICoreCollection {
    function setRoyaltyVault(address _royaltyVault) external;
    function owner() external view returns (address);
}

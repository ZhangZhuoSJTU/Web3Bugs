// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface IYearnV2Vault {
    function deposit(uint256 amount) external returns (uint256);
    function deposit() external returns (uint256);
    function withdraw(uint256 shares) external;
    function withdraw() external;
    function pricePerShare() external view returns (uint256);
    function token() external view returns (address);
}

// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IController {
    function vaults(address) external view returns (address);

    function strategies(address) external view returns (address);

    function rewards() external view returns (address);

    function approveStrategy(address, address) external;

    function setStrategy(address, address) external;

    function withdraw(address, uint256) external;

    function balanceOf(address) external view returns (uint256);

    function earn(address, uint256) external;
}

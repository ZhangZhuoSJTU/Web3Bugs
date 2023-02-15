// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IStrategy {
    function deposit() external payable returns (bool);

    function withdraw(uint256 amount) external returns (bool);

    function withdrawAll() external returns (uint256);

    function harvest() external returns (uint256);

    function shutdown() external returns (bool);

    function setCommunityReserve(address _communityReserve) external returns (bool);

    function setStrategist(address strategist_) external returns (bool);

    function name() external view returns (string memory);

    function balance() external view returns (uint256);

    function harvestable() external view returns (uint256);

    function strategist() external view returns (address);

    function hasPendingFunds() external view returns (bool);
}

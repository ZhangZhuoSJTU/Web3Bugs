// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IManager {
    function addToken(address, address) external;
    function allowedControllers(address) external view returns (bool);
    function allowedConverters(address) external view returns (bool);
    function allowedStrategies(address) external view returns (bool);
    function allowedTokens(address) external view returns (bool);
    function allowedVaults(address) external view returns (bool);
    function controllers(address) external view returns (address);
    function getHarvestFeeInfo() external view returns (address, address, uint256);
    function getTokens(address) external view returns (address[] memory);
    function governance() external view returns (address);
    function halted() external view returns (bool);
    function harvester() external view returns (address);
    function insuranceFee() external view returns (uint256);
    function insurancePool() external view returns (address);
    function insurancePoolFee() external view returns (uint256);
    function pendingStrategist() external view returns (address);
    function removeToken(address, address) external;
    function stakingPool() external view returns (address);
    function stakingPoolShareFee() external view returns (uint256);
    function strategist() external view returns (address);
    function tokens(address, uint256) external view returns (address);
    function treasury() external view returns (address);
    function treasuryFee() external view returns (uint256);
    function vaults(address) external view returns (address);
    function withdrawalProtectionFee() external view returns (uint256);
    function yaxis() external view returns (address);
}

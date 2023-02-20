// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

interface IZPAToken {
    function deposit(uint256) external;
    function redeem(uint256) external;
    function underlyingAsset() external view returns (address);
    function pricePerToken() external view returns (uint256);

    function initialFee() external view returns (uint256);
    function endFee() external view returns (uint256);
    function feeDuration() external view returns (uint256);
}

interface IZPAPool {
    function deposit(uint256, uint256) external;
    function withdraw(uint256, uint256) external;
    function exit(uint256, uint256) external;
    function getReward(uint256) external;
    function rewardEarned(uint256, address) external view returns (uint256);
    function poolTokenAddress(uint256) external view returns (address);
    function poolBalance(uint256, address) external view returns (uint256);
}

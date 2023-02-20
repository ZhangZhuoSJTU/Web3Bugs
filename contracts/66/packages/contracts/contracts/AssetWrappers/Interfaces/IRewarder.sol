// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.7;
import "./IERC20_8.sol";

interface IRewarder {
    function onJoeReward(address user, uint256 newLpAmount) external;

    function pendingTokens(address user) external view returns (uint256 pending);

    function rewardToken() external view returns (IERC20);
}
// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IStakingRewardsSignalOnly {
    function stakingToken() external view returns (address);

    function rewardsToken() external view returns (address);

    function withdraw(uint256) external;

    function getReward() external;

    function earned(address account) external view returns (uint256);

    function stake(uint256) external;

    function balanceOf(address) external view returns (uint256);

    function exit() external;
}

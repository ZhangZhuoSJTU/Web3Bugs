// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.9;

interface IStakingRewards {
    // Views

    function balanceOf(address account) external view returns (uint);

    function earned(address account) external view returns (uint);

    function getRewardForDuration() external view returns (uint);

    function lastTimeRewardApplicable() external view returns (uint);

    function rewardPerToken() external view returns (uint);

    // function rewardsDistribution() external view returns (address);

    // function rewardsToken() external view returns (address);

    function totalSupply() external view returns (uint);

    // Mutative

    function exit() external;

    function getReward() external;

    function stake(uint amount) external;

    function withdraw(uint amount) external;
}

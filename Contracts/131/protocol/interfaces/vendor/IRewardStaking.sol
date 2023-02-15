// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IRewardStaking {
    function stakeFor(address, uint256) external;

    function stake(uint256) external;

    function stakeAll() external returns (bool);

    function withdraw(uint256 amount, bool claim) external returns (bool);

    function withdrawAndUnwrap(uint256 amount, bool claim) external returns (bool);

    function earned(address account) external view returns (uint256);

    function getReward() external;

    function getReward(address _account, bool _claimExtras) external;

    function extraRewardsLength() external view returns (uint256);

    function extraRewards(uint256 _pid) external view returns (address);

    function rewardToken() external view returns (address);

    function balanceOf(address account) external view returns (uint256);
}

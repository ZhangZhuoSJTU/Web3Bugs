// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

interface ICvx {
    function reductionPerCliff() external view returns(uint256);
    function totalSupply() external view returns(uint256);
    function totalCliffs() external view returns(uint256);
    function maxSupply() external view returns(uint256);
}

interface IRewardStaking {
    struct PoolInfo {
        address lptoken;
        address token;
        address gauge;
        address crvRewards;
        address stash;
        bool shutdown;
    }

    function poolInfo(uint256) external view returns(PoolInfo memory);
    function stakeFor(address, uint256) external;
    function stake( uint256) external;
    function withdraw(uint256 amount, bool claim) external;
    function withdrawAndUnwrap(uint256 amount, bool claim) external;
    function earned(address account) external view returns (uint256);
    function getReward() external;
    function getReward(address _account, bool _claimExtras) external;
    function extraRewardsLength() external view returns (uint256);
    function extraRewards(uint256 _pid) external view returns (address);
    function rewardToken() external view returns (address);
    function balanceOf(address _account) external view returns (uint256);
}

interface IConvexDeposits {
    function deposit(uint256 _pid, uint256 _amount, bool _stake) external returns(bool);
    function deposit(uint256 _amount, bool _lock, address _stakeAddress) external;
}

// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../Adminable.sol";

/// @title Farming Pools
/// @author OpenLeverage
/// @notice Deposit OLE to earn inerest
/// @dev Rewards are released linearly 
contract FarmingPools is Adminable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public oleToken;

    struct Distribution {
        uint64 duration;
        uint64 starttime;
        uint64 periodFinish;
        uint64 lastUpdateTime;
        uint256 rewardRate;
        uint256 rewardPerTokenStored;
        uint256 totalStaked;
    }

    struct Reward {
        uint256 stakes;
        uint256 rewards;
        uint256 userRewardPerTokenPaid;
    }
    //stakeToken=>Distribution
    mapping(address => Distribution) public distributions;

    //stakeToken=>account=>rewards
    mapping(address => mapping(address => Reward)) public rewards;


    event RewardAdded(address indexed stakeToken, uint256 reward);
    event Staked(address indexed stakeToken, address indexed user, uint256 amount);
    event Withdrawn(address indexed stakeToken, address indexed user, uint256 amount);
    event RewardPaid(address indexed stakeToken, address indexed user, uint256 reward);

    constructor(address _oleToken, address payable _admin)
    {
        oleToken = IERC20(_oleToken);
        admin = _admin;
    }

    modifier checkStart(address stakeToken) {
        require(block.timestamp >= distributions[stakeToken].starttime, "not start");
        _;
    }

    modifier updateReward(address stakeToken, address account) {
        uint rewardPerTokenStored = rewardPerToken(stakeToken);
        distributions[stakeToken].rewardPerTokenStored = rewardPerTokenStored;
        distributions[stakeToken].lastUpdateTime = lastTimeRewardApplicable(stakeToken);
        if (account != address(0)) {
            rewards[stakeToken][account].rewards = earned(stakeToken, account);
            rewards[stakeToken][account].userRewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable(address stakeToken) public view returns (uint64) {
        return block.timestamp > distributions[stakeToken].periodFinish ? distributions[stakeToken].periodFinish : (uint64)(block.timestamp);
    }

    function rewardPerToken(address stakeToken) public view returns (uint256) {
        Distribution memory distribution = distributions[stakeToken];
        if (distribution.totalStaked == 0) {
            return distribution.rewardPerTokenStored;
        }
        uint64 lastTimeRewardApplicable = lastTimeRewardApplicable(stakeToken);
        assert(lastTimeRewardApplicable >= distribution.lastUpdateTime);
        return distribution.rewardPerTokenStored.add(
            distribution.rewardRate
            .mul(lastTimeRewardApplicable - distribution.lastUpdateTime)
            .mul(1e18)
            .div(distribution.totalStaked)
        );
    }

    function earned(address stakeToken, address account) public view returns (uint256) {
        Reward memory reward = rewards[stakeToken][account];
        return reward.stakes
        .mul(rewardPerToken(stakeToken).sub(reward.userRewardPerTokenPaid))
        .div(1e18)
        .add(reward.rewards);
    }

    function stake(address stakeToken, uint256 amount) external updateReward(stakeToken, msg.sender) checkStart(stakeToken) {
        require(amount > 0, "Cannot stake 0");
        distributions[stakeToken].totalStaked = distributions[stakeToken].totalStaked.add(amount);
        rewards[stakeToken][msg.sender].stakes = rewards[stakeToken][msg.sender].stakes.add(amount);
        IERC20(stakeToken).safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(stakeToken, msg.sender, amount);
    }

    function withdraw(address stakeToken, uint256 amount) public updateReward(stakeToken, msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        distributions[stakeToken].totalStaked = distributions[stakeToken].totalStaked.sub(amount);
        rewards[stakeToken][msg.sender].stakes = rewards[stakeToken][msg.sender].stakes.sub(amount);
        IERC20(stakeToken).safeTransfer(msg.sender, amount);
        emit Withdrawn(stakeToken, msg.sender, amount);
    }

    function exit(address stakeToken) external {
        withdraw(stakeToken, rewards[stakeToken][msg.sender].stakes);
        getReward(stakeToken);
    }

    function getReward(address stakeToken) public updateReward(stakeToken, msg.sender) checkStart(stakeToken) {
        uint256 reward = rewards[stakeToken][msg.sender].rewards;
        if (reward > 0) {
            rewards[stakeToken][msg.sender].rewards = 0;
            oleToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(stakeToken, msg.sender, reward);
        }
    }

    function getRewards(address[] memory stakeTokens) external {
        for (uint256 i = 0; i < stakeTokens.length; i++) {
            getReward(stakeTokens[i]);
        }
    }

    function initDistributions(address[] memory stakeTokens, uint64[] memory startTimes, uint64[] memory durations) external onlyAdmin {
        for (uint256 i = 0; i < stakeTokens.length; i++) {
            require(distributions[stakeTokens[i]].starttime == 0, 'Init once');
            distributions[stakeTokens[i]] = Distribution(durations[i], startTimes[i], 0, 0, 0, 0, 0);
        }
    }

    function notifyRewardAmount(address stakeToken, uint256 reward) public onlyAdmin updateReward(stakeToken, address(0))
    {
        Distribution storage distribution = distributions[stakeToken];
        if (block.timestamp > distribution.starttime) {
            if (block.timestamp >= distribution.periodFinish) {
                distribution.rewardRate = reward.div(distribution.duration);
            } else {
                uint256 remaining = distribution.periodFinish - block.timestamp;
                uint256 leftover = remaining.mul(distribution.rewardRate);
                distribution.rewardRate = reward.add(leftover).div(distribution.duration);
            }
            distribution.lastUpdateTime = uint64(block.timestamp);
            distribution.periodFinish = uint64(block.timestamp) + distribution.duration;
            require(distribution.periodFinish >= uint64(block.timestamp));
        } else {
            distribution.rewardRate = reward.div(distribution.duration);
            distribution.lastUpdateTime = distribution.starttime;
            distribution.periodFinish = distribution.starttime + distribution.duration;
            require(distribution.periodFinish >= distribution.starttime);
        }
        // max rate 1000 ole 1s
        require(distribution.rewardRate < 1e21, 'overflow');
        emit RewardAdded(stakeToken, reward);
    }

    function notifyRewardAmounts(address[] memory stakeTokens, uint256[] memory reward) external {
        for (uint256 i = 0; i < stakeTokens.length; i++) {
            notifyRewardAmount(stakeTokens[i], reward[i]);
        }
    }

}

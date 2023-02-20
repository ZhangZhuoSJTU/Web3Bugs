// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IBkdLocker {
    struct WithdrawStash {
        uint256 releaseTime;
        uint256 amount;
    }

    struct RewardTokenData {
        mapping(address => uint256) userFeeIntegrals;
        mapping(address => uint256) userShares;
        uint256 feeBalance;
        uint256 feeIntegral;
    }

    event Locked(address indexed user, uint256 amount);
    event WithdrawPrepared(address indexed user, uint256 amount);
    event WithdrawExecuted(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, address indexed rewardToken, uint256 amount);
    event FeesDeposited(uint256 amount);

    function initialize(
        uint256 startBoost,
        uint256 maxBoost,
        uint256 increasePeriod,
        uint256 withdrawDelay
    ) external;

    function migrate(address newRewardToken) external;

    function lock(uint256 amount) external;

    function lockFor(address user, uint256 amount) external;

    function userCheckpoint(address user) external;

    function claimFees() external;

    function claimFees(address _rewardToken) external;

    function prepareUnlock(uint256 amount) external;

    function executeUnlocks() external;

    function depositFees(uint256 amount) external;

    function getUserShare(address user) external view returns (uint256);

    function getUserShare(address user, address _rewardToken) external view returns (uint256);

    function getStashedGovTokens(address user) external view returns (WithdrawStash[] memory);

    function claimableFees(address user) external view returns (uint256);

    function claimableFees(address user, address _rewardToken) external view returns (uint256);

    function boostedBalance(address user) external view returns (uint256);

    function balanceOf(address user) external view returns (uint256);

    function getShareOfTotalBoostedBalance(address user) external view returns (uint256);

    function computeNewBoost(
        address user,
        uint256 amountAdded,
        uint256 newTotal
    ) external view returns (uint256);

    function rewardToken() external view returns (address);
}

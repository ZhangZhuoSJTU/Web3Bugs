// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

interface ICvxLocker {
    function getReward(address _account, bool _stake) external;

    function balanceOf(address _user) external view returns (uint256);

    function rewardData(address _token)
        external
        view
        returns (
            bool useBoost,
            uint40 periodFinish,
            uint208 rewardRate,
            uint40 lastUpdateTime,
            uint208 rewardPerTokenStored
        );

    function lock(
        address _account,
        uint256 _amount,
        uint256 _spendRatio
    ) external;

    function processExpiredLocks(bool _relock) external;

    function withdrawExpiredLocksTo(address _withdrawTo) external;

    function maximumBoostPayment() external returns (uint256);

    function setBoost(
        uint256 _max,
        uint256 _rate,
        address _receivingAddress
    ) external;

    function lockedBalanceOf(address _user) external view returns (uint256 amount);

    function checkpointEpoch() external;

    event RewardAdded(address indexed _token, uint256 _reward);
    event Staked(
        address indexed _user,
        uint256 indexed _epoch,
        uint256 _paidAmount,
        uint256 _lockedAmount,
        uint256 _boostedAmount
    );

    event Withdrawn(address indexed _user, uint256 _amount, bool _relocked);
    event KickReward(address indexed _user, address indexed _kicked, uint256 _reward);
    event RewardPaid(address indexed _user, address indexed _rewardsToken, uint256 _reward);
    event Recovered(address _token, uint256 _amount);
}

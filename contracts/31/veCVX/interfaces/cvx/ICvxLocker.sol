// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ICvxLocker {
    function maximumBoostPayment() external returns (uint256);

    function lock(
        address _account,
        uint256 _amount,
        uint256 _spendRatio
    ) external;

    function getReward(address _account, bool _stake) external;

    //BOOSTED balance of an account which only includes properly locked tokens as of the most recent eligible epoch
    function balanceOf(address _user) external view returns (uint256 amount);

    // total token balance of an account, including unlocked but not withdrawn tokens
    function lockedBalanceOf(address _user)
        external
        view
        returns (uint256 amount);

    // Withdraw/relock all currently locked tokens where the unlock time has passed
    function processExpiredLocks(
        bool _relock,
        uint256 _spendRatio,
        address _withdrawTo
    ) external;

    // Withdraw/relock all currently locked tokens where the unlock time has passed
    function processExpiredLocks(bool _relock) external;
}

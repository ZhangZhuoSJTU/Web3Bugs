// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

interface ICvxCrvRewardsLocker {
    function lockRewards() external returns (bool);

    function lockCvx() external;

    function lockCrv() external;

    function claimRewards(bool lockAndStake) external returns (bool);

    function stakeCvxCrv() external returns (bool);

    function processExpiredLocks(bool relock) external returns (bool);
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface ICvxCrvRewardsLocker {
    function lockRewards() external returns (bool);

    function lockCvx() external;

    function lockCrv() external;

    function claimRewards(bool lockAndStake) external returns (bool);

    function stakeCvxCrv() external returns (bool);

    function processExpiredLocks(bool relock) external returns (bool);

    function setSpendRatio(uint256 _spendRatio) external returns (bool);

    function setWithdrawalFlag() external;

    function resetWithdrawalFlag() external;

    function setTreasury(address _treasury) external returns (bool);

    function withdraw(address token) external returns (bool);

    function withdrawCvxCrv(uint256 amount) external;

    function unstakeCvxCrv() external;

    function unstakeCvxCrv(uint256 amount, bool withdrawal) external;

    function setDelegate(address delegateContract, address delegate) external;

    function clearDelegate(address delegateContract) external;

    function forfeitRewards(address token, uint256 index) external;

    function withdraw(address token, uint256 amount) external returns (bool);

    function unstakeCvxCrv(bool withdrawal) external;
}

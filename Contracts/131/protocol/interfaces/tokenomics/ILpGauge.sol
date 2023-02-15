// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface ILpGauge {
    function poolCheckpoint() external returns (bool);

    function userCheckpoint(address user) external returns (bool);

    function claimableRewards(address beneficiary) external view returns (uint256);
}

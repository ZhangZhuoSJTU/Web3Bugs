// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IRewardsGauge {
    function claimRewards(address beneficiary) external returns (uint256);
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;
import "./IRewardsGauge.sol";

interface IKeeperGauge is IRewardsGauge {
    function reportFees(
        address beneficiary,
        uint256 amount,
        address lpTokenAddress
    ) external returns (bool);

    function advanceEpoch() external returns (bool);

    function poolCheckpoint() external returns (bool);

    function kill() external returns (bool);

    function claimRewards(address beneficiary, uint256 endEpoch) external returns (uint256);

    function killed() external view returns (bool);

    function claimableRewards(address beneficiary) external view returns (uint256);
}

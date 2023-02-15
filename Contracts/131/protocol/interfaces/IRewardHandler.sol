// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IRewardHandler {
    event Burned(address rewardToken, uint256 totalAmount);

    function burnFees() external;
}

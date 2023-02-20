// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

interface IConcurRewardClaim {
    function pushReward(
        address _recipient,
        address _token,
        uint256 _amount
    ) external;

    function claimRewards(address[] calldata _tokens) external;
}

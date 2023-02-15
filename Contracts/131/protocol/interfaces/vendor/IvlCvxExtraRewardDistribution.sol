// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IvlCvxExtraRewardDistribution {
    function getReward(address _account, address _token) external;

    function getRewards(address _account, address[] calldata _tokens) external;

    function forfeitRewards(address _token, uint256 _index) external;
}

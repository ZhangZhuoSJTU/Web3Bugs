// SPDX-License-Identifier: MIT

pragma solidity >= 0.5.0 <= 0.9.0;

interface IStakedCitadelLocker {
    function initialize(
        address _stakingToken,
        string calldata name,
        string calldata symbol
    ) external;

    function addReward(
        address _rewardsToken,
        address _distributor,
        bool _useBoost
    ) external;


    function notifyRewardAmount(address _rewardsToken, uint256 _reward)
        external;
}

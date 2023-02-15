//SPDX-License-Identifier: Unlicense
pragma solidity >=0.5.0 <0.8.0;

interface ISimpleTimelockWithVoting {
    function release() external;

    function vote(
        uint256 _voteId,
        bool _supports,
        bool _executesIfDecided
    ) external payable;
}

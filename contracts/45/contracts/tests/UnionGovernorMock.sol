//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../governance/UnionGovernor.sol";

contract UnionGovernorMock is UnionGovernor {
    constructor(ERC20VotesComp _token, TimelockController _timelock) UnionGovernor(_token, _timelock) {}

    function votingDelay() public pure override returns (uint256) {
        return 2;
    }

    function votingPeriod() public pure override returns (uint256) {
        return 5760;
    }

    function proposalThreshold() public pure override returns (uint256) {
        return 50000e18;
    }
}

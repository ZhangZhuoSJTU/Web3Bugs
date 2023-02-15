// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

contract MockVoting {
    mapping(address => uint256) public gaugeWeights;

    mapping(uint256 => uint256) public votesFor;

    mapping(uint256 => uint256) public votesAgainst;

    struct VotedSlope {
        uint256 slope;
        uint256 power;
        uint256 end;
    }

    function vote(
        uint256 voteId,
        bool support,
        bool
    ) external {
        if (support) {
            votesFor[voteId]++;
        } else {
            votesAgainst[voteId]++;
        }
    }

    function vote_for_gauge_weights(address gauge, uint256 weight) external {
        gaugeWeights[gauge] += weight;
    }

    function get_gauge_weight(address gauge) external view returns (uint256) {
        return gaugeWeights[gauge];
    }

    function vote_user_slopes(address user, address gauge) external view returns (VotedSlope memory) {
        return VotedSlope(0, 0, 0);
    }

    // Total vote power used by user
    function vote_user_power(address user) external view returns (uint256) {
        return 0;
    }

    // Last user vote's timestamp for each gauge address
    function last_user_vote(address user, address gauge) external view returns (uint256) {
        return 0;
    }
}

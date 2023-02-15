// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;

contract MockAggregator {
    int256 private _answer;
    uint8 public decimals;

    // AggregatorV1 event
    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 timestamp);

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function latestRoundData() external view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {

        return (0, _answer, 0, 0, 0);
    }

    function latestAnswer() external view returns (int256) {
        return _answer;
    }

    function setAnswer(int256 a) external {
        _answer = a;
        emit AnswerUpdated(a, 0, block.timestamp);
    }
}
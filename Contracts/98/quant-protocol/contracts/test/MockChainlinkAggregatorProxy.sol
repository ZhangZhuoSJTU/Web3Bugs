// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

contract MockChainlinkAggregatorProxy {
    int256 private _defaultLatestAnswer;

    constructor(int256 defaultLatestAnswer_) {
        _defaultLatestAnswer = defaultLatestAnswer_;
    }

    function latestAnswer() external view returns (int256) {
        return _defaultLatestAnswer;
    }
}

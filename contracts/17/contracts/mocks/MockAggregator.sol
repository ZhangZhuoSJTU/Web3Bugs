// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "contracts/interfaces/IChainlinkAggregator.sol";

contract MockAggregator is IChainlinkAggregator {
    uint80 public roundId_;
    int256 public answer_;
    uint256 public startedAt_;
    uint256 public updatedAt_;
    uint80 public answeredInRound_;

    constructor(int256 latestPrice) public {
        roundId_ = 1;
        answer_ = latestPrice;
        startedAt_ = block.timestamp;
        updatedAt_ = block.timestamp;
        answeredInRound_ = 1;
    }

    function setPrice(int256 newPrice) external {
        answer_ = newPrice;
        updatedAt_ = block.timestamp;
        answeredInRound_ = answeredInRound_ + 1;
        roundId_ = roundId_ + 1;
    }

    function latestRound() external view override returns (uint256) {
        return uint256(roundId_);
    }

    function latestAnswer() external view override returns (int256) {
        return answer_;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract FluxAggregator {
    uint256 public version = 3;
    uint8 public decimals;
    string public description;

    int256 public value = 1;
    uint80 latestRoundId = 5;

    function setValue(int256 newVal) public {
        value = newVal;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (0, value, 0, 0, 0);
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, value, 0, 0, 0);
    }
}

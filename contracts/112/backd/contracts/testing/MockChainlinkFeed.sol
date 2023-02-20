// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.9;

contract MockChainlinkFeed {
    uint8 public immutable decimals;
    int256 public immutable price;
    uint256 public immutable lastUpdate;

    constructor(
        uint8 _decimals,
        int256 _price,
        uint256 _lastUpdate
    ) {
        decimals = _decimals;
        price = _price;
        lastUpdate = _lastUpdate;
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
        return (0, price, lastUpdate, lastUpdate, 0);
    }
}

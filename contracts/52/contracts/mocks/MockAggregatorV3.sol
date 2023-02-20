// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAggregatorV3 {
    IERC20 public token;

    uint80 private _storedRoundId;

    constructor(IERC20 _token) {
        token = _token;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function version() external pure returns (uint256) {
        return 3;
    }

    function getRoundData(uint80 _roundId)
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
        // Mock Data
        roundId = _roundId;
        answer = 1e8;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = roundId;
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
        // Mock Data
        roundId = _storedRoundId + 1;
        answer = 1e8;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = roundId;
    }
}

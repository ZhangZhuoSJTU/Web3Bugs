// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

interface AggregatorInterface {
      function latestAnswer() external view returns (int256);
      function latestTimestamp() external view returns (uint256);
      function latestRound() external view returns (uint256);
      function getAnswer(uint256 roundId) external view returns (int256);
      function getTimestamp(uint256 roundId) external view returns (uint256);
}

interface AggregatorV3Interface {

      function decimals() external view returns (uint8);
      function description() external view returns (string memory);
      function version() external view returns (uint256);

      // getRoundData and latestRoundData should both raise "No data present"
      // if they do not have data to report, instead of returning unset values
      // which could be misinterpreted as actual reported values.
      function getRoundData(uint80 _roundId)
            external
            view
            returns (
                  uint80 roundId,
                  int256 answer,
                  uint256 startedAt,
                  uint256 updatedAt,
                  uint80 answeredInRound
            );
      function latestRoundData()
            external
            view
            returns (
                  uint80 roundId,
                  int256 answer,
                  uint256 startedAt,
                  uint256 updatedAt,
                  uint80 answeredInRound
            );
}

interface AggregatorV2V3Interface is AggregatorInterface, AggregatorV3Interface
{
}

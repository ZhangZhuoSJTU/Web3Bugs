// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IAggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestAnswer() external view returns (int256 answer);
}

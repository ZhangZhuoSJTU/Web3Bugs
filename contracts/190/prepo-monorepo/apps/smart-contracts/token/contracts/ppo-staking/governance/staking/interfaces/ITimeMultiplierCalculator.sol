// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

interface ITimeMultiplierCalculator {
  function calculate(uint256 _timestamp) external view returns (uint256);
}

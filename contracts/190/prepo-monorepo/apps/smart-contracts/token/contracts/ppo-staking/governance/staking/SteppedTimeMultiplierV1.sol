// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ITimeMultiplierCalculator.sol";

contract SteppedTimeMultiplierV1 is ITimeMultiplierCalculator {
  function calculate(uint256 _timestamp)
    external
    view
    override
    returns (uint256 timeMultiplier)
  {
    // If user has no timestamp, it means they haven't staked
    if (_timestamp == 0) return 1000000000000;

    uint256 hodlLength = block.timestamp - _timestamp;
    if (hodlLength < 13 weeks) {
      // 0-3 months = 1x
      return 1000000000000;
    } else if (hodlLength < 26 weeks) {
      // 3 months = 1.2x
      return 1200000000000;
    } else if (hodlLength < 52 weeks) {
      // 6 months = 1.3x
      return 1300000000000;
    } else if (hodlLength < 78 weeks) {
      // 12 months = 1.4x
      return 1400000000000;
    } else if (hodlLength < 104 weeks) {
      // 18 months = 1.5x
      return 1500000000000;
    }
    // >24 months = 1.6x
    return 1600000000000;
  }
}

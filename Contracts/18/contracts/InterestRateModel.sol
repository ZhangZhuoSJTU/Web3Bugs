// SPDX-License-Identifier: UNLICENSED

// Copyright (c) 2021 0xdev0 - All rights reserved
// https://twitter.com/0xdev0

pragma solidity ^0.8.0;

import './interfaces/ILendingPair.sol';
import './interfaces/IERC20.sol';

import './external/Math.sol';

contract InterestRateModel {

  // Per block
  uint public constant MIN_RATE  = 0;
  uint public constant LOW_RATE  = 8371385083713;   // 20%    / year = 20e18   / 365 / 86400 * 13.2 (block time)
  uint public constant HIGH_RATE = 418569254185692; // 1,000% / year = 1000e18 / 365 / 86400 * 13.2 (block time)

  uint public constant TARGET_UTILIZATION = 80e18; // 80%
  uint public constant SYSTEM_RATE        = 50e18; // share of fees earned by the system

  function supplyRatePerBlock(ILendingPair _pair, address _token) external view returns(uint) {
    return borrowRatePerBlock(_pair, _token) * (100e18 - SYSTEM_RATE) / 100e18;
  }

  function borrowRatePerBlock(ILendingPair _pair, address _token) public view returns(uint) {
    uint debt = _pair.totalDebt(_token);
    uint supply = IERC20(_pair.lpToken(_token)).totalSupply();

    if (supply == 0 || debt == 0) { return MIN_RATE; }

    uint utilization = Math.min(debt * 100e18 / supply, 100e18);

    if (utilization < TARGET_UTILIZATION) {
      uint rate = LOW_RATE * utilization / 100e18;
      return (rate < MIN_RATE) ? MIN_RATE : rate;
    } else {
      utilization = 100e18 * ( debt - (supply * TARGET_UTILIZATION / 100e18) ) / (supply * (100e18 - TARGET_UTILIZATION) / 100e18);
      utilization = Math.min(utilization, 100e18);
      return LOW_RATE + (HIGH_RATE - LOW_RATE) * utilization / 100e18;
    }
  }

  function utilizationRate(ILendingPair _pair, address _token) external view returns(uint) {
    uint debt = _pair.totalDebt(_token);
    uint supply = IERC20(_pair.lpToken(_token)).totalSupply();

    if (supply == 0 || debt == 0) { return 0; }

    return Math.min(debt * 100e18 / supply, 100e18);
  }

  // InterestRateModel can later be replaced for more granular fees per _lendingPair
  function systemRate(ILendingPair _pair, address _token) external pure returns(uint) {
    return SYSTEM_RATE;
  }
}

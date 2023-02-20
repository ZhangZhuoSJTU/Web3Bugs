// SPDX-License-Identifier: UNLICENSED

// Copyright (c) 2021 0xdev0 - All rights reserved
// https://twitter.com/0xdev0

pragma solidity 0.8.6;

import './interfaces/IERC20.sol';
import './interfaces/IInterestRateModel.sol';

import './external/Math.sol';
import './external/Ownable.sol';

contract InterestRateModel is IInterestRateModel, Ownable {

  // InterestRateModel can be re-deployed later
  uint private constant BLOCK_TIME = 132e17; // 13.2 seconds
  uint private constant LP_RATE = 50e18; // 50%

  // Per block
  uint public minRate;
  uint public lowRate;
  uint public highRate;
  uint public targetUtilization; // 80e18 = 80%

  event NewMinRate(uint value);
  event NewLowRate(uint value);
  event NewHighRate(uint value);
  event NewTargetUtilization(uint value);

  constructor(
    uint _minRate,
    uint _lowRate,
    uint _highRate,
    uint _targetUtilization
  ) {
    minRate           = _timeRateToBlockRate(_minRate);
    lowRate           = _timeRateToBlockRate(_lowRate);
    highRate          = _timeRateToBlockRate(_highRate);
    targetUtilization = _targetUtilization;
  }

  function setMinRate(uint _value) external onlyOwner {
    require(_value < lowRate, "InterestRateModel: _value < lowRate");
    minRate = _timeRateToBlockRate(_value);
    emit NewMinRate(_value);
  }

  function setLowRate(uint _value) external onlyOwner {
    require(_value < highRate, "InterestRateModel: _value < lowRate");
    lowRate = _timeRateToBlockRate(_value);
    emit NewLowRate(_value);
  }

  function setHighRate(uint _value) external onlyOwner {
    highRate = _timeRateToBlockRate(_value);
    emit NewHighRate(_value);
  }

  function setTargetUtilization(uint _value) external onlyOwner {
    require(_value < 99e18, "InterestRateModel: _value < 100e18");
    targetUtilization = _value;
    emit NewTargetUtilization(_value);
  }

  // InterestRateModel can later be replaced for more granular fees per _pair
  function interestRatePerBlock(
    address _pair,
    address _token,
    uint    _totalSupply,
    uint    _totalDebt
  ) external view override returns(uint) {
    if (_totalSupply == 0 || _totalDebt == 0) { return minRate; }

    uint utilization = (_totalDebt * 100e18 / _totalSupply) * 100e18 / targetUtilization;

    if (utilization < 100e18) {
      uint rate = lowRate * utilization / 100e18;
      return Math.max(rate, minRate);
    } else {
      utilization = 100e18 * ( _totalDebt - (_totalSupply * targetUtilization / 100e18) ) / (_totalSupply * (100e18 - targetUtilization) / 100e18);
      utilization = Math.min(utilization, 100e18);
      return lowRate + (highRate - lowRate) * utilization / 100e18;
    }
  }

  // InterestRateModel can later be replaced for more granular fees per _pair
  function utilizationRate(
    address _pair,
    address _token,
    uint    _totalDebt,
    uint    _totalSupply
  ) external view returns(uint) {
    if (_totalSupply == 0 || _totalDebt == 0) { return 0; }
    return Math.min(_totalDebt * 100e18 / _totalSupply, 100e18);
  }

  // InterestRateModel can later be replaced for more granular fees per _pair
  function lpRate(address _pair, address _token) external view override returns(uint) {
    return LP_RATE;
  }

  // _uint is set as 1e18 = 1% (annual) and converted to the block rate
  function _timeRateToBlockRate(uint _uint) private view returns(uint) {
    return _uint / 365 / 86400 * BLOCK_TIME / 1e18;
  }
}

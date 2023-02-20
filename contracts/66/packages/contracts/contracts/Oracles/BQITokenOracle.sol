// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import '../Dependencies/SafeMath.sol';

import '../Interfaces/IBaseOracle.sol';

import "../Dependencies/Ownable.sol";

interface IQIToken {
    function exchangeRateCurrent() external returns (uint);
    function underlying() external returns (address);
}

contract BQIOracle is Ownable {
  using SafeMath for uint;

  IBaseOracle base;
  address underlying;
  IQIToken BQI;

  function setParam(IBaseOracle _base, address _BQI, address _underlying) external onlyOwner {
    base = _base;
    underlying = _underlying;
    BQI=IQIToken(_BQI);
  }

  function fetchPrice_v() external returns (uint) {
    return BQI.exchangeRateCurrent()*base.getPrice(underlying)/1e18;
  }
  function fetchPrice() external returns (uint) {
    return BQI.exchangeRateCurrent()*base.getPrice(underlying)/1e18;
  }
}
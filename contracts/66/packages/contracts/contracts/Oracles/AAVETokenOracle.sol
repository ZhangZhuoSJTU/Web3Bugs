// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import '../Dependencies/SafeMath.sol';

import '../Interfaces/IBaseOracle.sol';

import "../Dependencies/Ownable.sol";

interface IWAAVE {
    function aavePerShare() external returns (uint);
}

contract AAVEOracle is Ownable {
  using SafeMath for uint;

  IBaseOracle base;
  address underlying;
  IWAAVE WAAVE;

  function setParam(IBaseOracle _base, address _WAAVE, address _underlying) external onlyOwner {
    base = _base;
    underlying = _underlying;
    WAAVE=IWAAVE(_WAAVE);
  }

  function fetchPrice_v() external returns (uint) {
    return WAAVE.aavePerShare()*base.getPrice(underlying)/1e18;
  }
  function fetchPrice() external returns (uint) {
    return WAAVE.aavePerShare()*base.getPrice(underlying)/1e18;
  }
}
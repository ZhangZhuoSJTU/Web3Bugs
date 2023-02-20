// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import './ILendingPair.sol';

interface IInterestRateModel {
  function systemRate(ILendingPair _pair, address _token) external view returns(uint);
  function supplyRatePerBlock(ILendingPair _pair, address _token) external view returns(uint);
  function borrowRatePerBlock(ILendingPair _pair, address _token) external view returns(uint);
}
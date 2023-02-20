// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

interface IInterestRateModel {
  function lpRate(address _pair, address _token) external view returns(uint);
  function interestRatePerBlock(address _pair, address _token, uint _totalSupply, uint _totalDebt) external view returns(uint);
}
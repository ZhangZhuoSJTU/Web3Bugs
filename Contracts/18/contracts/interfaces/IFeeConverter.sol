// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import './ILendingPair.sol';

interface IFeeConverter {

  function convert(
    address _sender,
    ILendingPair _pair,
    address[] memory _path,
    uint _supplyTokenAmount
  ) external;
}

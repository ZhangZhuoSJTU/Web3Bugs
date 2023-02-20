// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.6;

import './IOwnable.sol';
import './IERC20.sol';

interface ILPTokenMaster is IOwnable, IERC20 {
  function initialize(address _underlying, address _lendingController) external;
  function underlying() external view returns(address);
  function lendingPair() external view returns(address);
}

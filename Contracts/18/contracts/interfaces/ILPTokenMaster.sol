// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import './IERC20.sol';

interface ILPTokenMaster is IERC20 {
  function initialize() external;
  function transferOwnership(address newOwner) external;
  function underlying() external view returns(address);
  function owner() external view returns(address);
  function lendingPair() external view returns(address);
  function selfBurn(uint _amount) external;
}

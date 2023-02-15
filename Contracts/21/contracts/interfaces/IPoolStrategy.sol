// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IStrategy.sol';

/// @title Sherlock Pool Strategy Controller
/// @author Evert Kors
/// @notice This contract is for every token pool
/// @dev Used for activate token assets for earning yield
/// @dev Contract is meant to be included as a facet in the diamond
/// @dev Storage library is used
/// @dev Storage pointer is calculated based on last _token argument
interface IPoolStrategy {
  function getStrategy(IERC20 _token) external view returns (IStrategy);

  function strategyRemove(IERC20 _token) external;

  function strategyUpdate(IStrategy _strategy, IERC20 _token) external;

  function strategyDeposit(uint256 _amount, IERC20 _token) external;

  function strategyWithdraw(uint256 _amount, IERC20 _token) external;

  function strategyWithdrawAll(IERC20 _token) external;
}

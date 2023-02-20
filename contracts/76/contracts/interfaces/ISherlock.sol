// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import './ISherlockStake.sol';
import './ISherlockGov.sol';
import './ISherlockPayout.sol';
import './ISherlockStrategy.sol';

interface ISherlock is ISherlockStake, ISherlockGov, ISherlockPayout, ISherlockStrategy, IERC721 {
  // msg.sender is not authorized to call this function
  error Unauthorized();

  // An address or other value passed in is equal to zero (and shouldn't be)
  error ZeroArgument();

  // Occurs when a value already holds the desired property, or is not whitelisted
  error InvalidArgument();

  // Required conditions are not true/met
  error InvalidConditions();

  // If the SHER tokens held in a contract are not the value they are supposed to be
  error InvalidSherAmount(uint256 expected, uint256 actual);

  // Checks the ERC-721 functions _exists() to see if an NFT ID actually exists and errors if not
  error NonExistent();

  event ArbRestaked(uint256 indexed tokenID, uint256 reward);

  event Restaked(uint256 indexed tokenID);
}

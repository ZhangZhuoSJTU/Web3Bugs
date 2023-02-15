// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.1;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

interface ISherXERC20 {
  //
  // View methods
  //

  /// @notice Get the token name
  /// @return The token name
  function name() external view returns (string memory);

  /// @notice Get the token symbol
  /// @return The token symbol
  function symbol() external view returns (string memory);

  /// @notice Get the amount of decimals
  /// @return Amount of decimals
  function decimals() external view returns (uint8);

  //
  // State changing methods
  //

  /// @notice Sets up the metadata and initial supply. Can be called by the contract owner
  /// @param _name Name of the token
  /// @param _symbol Symbol of the token
  function initializeSherXERC20(string memory _name, string memory _symbol) external;

  /// @notice Increase the amount of tokens another address can spend
  /// @param _spender Spender
  /// @param _amount Amount to increase by
  function increaseApproval(address _spender, uint256 _amount) external returns (bool);

  /// @notice Decrease the amount of tokens another address can spend
  /// @param _spender Spender
  /// @param _amount Amount to decrease by
  function decreaseApproval(address _spender, uint256 _amount) external returns (bool);
}

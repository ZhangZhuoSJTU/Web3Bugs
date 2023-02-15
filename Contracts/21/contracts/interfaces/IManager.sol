// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title Sherlock Protocol Manager
/// @author Evert Kors
/// @notice Managing the amounts protocol are due to Sherlock
interface IManager {
  //
  // State changing methods
  //

  /// @notice Set internal price of `_token` to `_newUsd`
  /// @param _token Token to be updated
  /// @param _newUsd USD amount of token
  /// @dev Updating token price for 1 token
  function setTokenPrice(IERC20 _token, uint256 _newUsd) external;

  /// @notice Set internal price of multiple tokens
  /// @param _token Array of token addresses
  /// @param _newUsd Array of USD amounts
  /// @dev Updating token price for 1+ tokens
  function setTokenPrice(IERC20[] memory _token, uint256[] memory _newUsd) external;

  /// @notice Set `_token` premium for `_protocol` to `_premium` per block
  /// @param _protocol Protocol identifier
  /// @param _token Token address
  /// @param _premium Amount of tokens to be paid per block
  /// @dev Updating protocol premium for 1 token
  function setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium
  ) external;

  /// @notice Set multiple token premiums for `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _token Array of token addresses
  /// @param _premium Array of amount of tokens to be paid per block
  /// @dev Updating protocol premium for 1+ tokens
  function setProtocolPremium(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium
  ) external;

  // NOTE: note implemented for now, same call with price has better use case
  // updating multiple protocol's premiums for 1 tokens
  // function setProtocolPremium(
  //   bytes32[] memory _protocol,
  //   IERC20 memory _token,
  //   uint256[] memory _premium
  // ) external;

  /// @notice Set multiple tokens premium for multiple protocols
  /// @param _protocol Array of protocol identifiers
  /// @param _token 2 dimensional array of token addresses
  /// @param _premium 2 dimensional array of amount of tokens to be paid per block
  /// @dev Updating multiple protocol's premium for 1+ tokens
  function setProtocolPremium(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium
  ) external;

  /// @notice Set `_token` premium for `_protocol` to `_premium` per block and internal price to `_newUsd`
  /// @param _protocol Protocol identifier
  /// @param _token Token address
  /// @param _premium Amount of tokens to be paid per block
  /// @param _newUsd USD amount of token
  /// @dev Updating protocol premium and token price for 1 token
  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _newUsd
  ) external;

  /// @notice Set multiple token premiums for `_protocol` and update internal prices
  /// @param _protocol Protocol identifier
  /// @param _token Array of token addresses
  /// @param _premium Array of amount of tokens to be paid per block
  /// @param _newUsd Array of USD amounts
  /// @dev Updating protocol premiums and token price for 1+ token
  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium,
    uint256[] memory _newUsd
  ) external;

  /// @notice Set `_token` premium for protocols and internal price to `_newUsd`
  /// @param _protocol Array of protocol identifiers
  /// @param _token Token address
  /// @param _premium Array of amount of tokens to be paid per block
  /// @param _newUsd USD amount
  /// @dev Updating multiple protocol premiums for 1 token, including price
  function setProtocolPremiumAndTokenPrice(
    bytes32[] memory _protocol,
    IERC20 _token,
    uint256[] memory _premium,
    uint256 _newUsd
  ) external;

  /// @notice Update multiple token premiums and prices for multiple protocols
  /// @param _protocol Array of protocol identifiers
  /// @param _token 2 dimensional array of tokens
  /// @param _premium 2 dimensional array of amounts to be paid per block
  /// @param _newUsd 2 dimensional array of USD amounts
  /// @dev Updating multiple protocol premiums for multiple tokens, including price
  function setProtocolPremiumAndTokenPrice(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium,
    uint256[][] memory _newUsd
  ) external;
}

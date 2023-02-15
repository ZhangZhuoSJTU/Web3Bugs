// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISherClaim.sol';

/// @title Claim SHER tokens send to the contract
/// @author Evert Kors
/// @dev This contract allows users to claim their bought SHER
/// @dev The contract has two states seperated by the `claimableAt` timestamp
/// @dev Up until the timestamp, to be claimed SHER can be added using `add()`
/// @dev After and including the timestamp, SHER can be claimed using `claim())`
contract SherClaim is ISherClaim {
  using SafeERC20 for IERC20;

  // The state switch needs to be executed between BOTTOM and CEILING after deployment
  uint256 internal constant CLAIM_PERIOD_SANITY_BOTTOM = 7 days;
  uint256 internal constant CLAIM_PERIOD_SANITY_CEILING = 14 days;

  // Timestamp when SHER can be claimed
  uint256 public immutable override claimableAt;
  // SHER token address (18 decimals)
  IERC20 public immutable sher;

  // Mapping how much each user is able to claim
  mapping(address => uint256) public userClaims;

  /// @notice Construct claim contract
  /// @param _sher ERC20 contract for SHER token
  /// @param _claimableAt Timestamp when SHER tokens will be claimable
  /// @dev _claimableAt is between BOTTOM and CEILING after deployment
  constructor(IERC20 _sher, uint256 _claimableAt) {
    if (address(_sher) == address(0)) revert ZeroArgument();
    // Verify if _claimableAt has a valid value
    if (_claimableAt < block.timestamp + CLAIM_PERIOD_SANITY_BOTTOM) revert InvalidState();
    if (_claimableAt > block.timestamp + CLAIM_PERIOD_SANITY_CEILING) revert InvalidState();

    sher = _sher;
    claimableAt = _claimableAt;
  }

  /// @notice Check if SHER tokens can be claimed
  /// @return True if the claim period is active
  function active() public view returns (bool) {
    return block.timestamp >= claimableAt;
  }

  /// @notice Add `_amount` SHER to the timelock for `_user`
  /// @param _user The account that is able to claim the SHER
  /// @param _amount The amount of SHER that is added to the timelock
  function add(address _user, uint256 _amount) external override {
    if (_user == address(0)) revert ZeroArgument();
    if (_amount == 0) revert ZeroArgument();
    // Only allow new SHER to be added pre claim period
    if (active()) revert InvalidState();

    // Transfer SHER from caller to this contract
    sher.safeTransferFrom(msg.sender, address(this), _amount);
    // Account how much SHER the `_user` is able to claim
    userClaims[_user] += _amount;

    // Emit event about the new SHER tokens
    emit Add(msg.sender, _user, _amount);
  }

  /// @notice Allow caller to claim SHER tokens
  /// @dev Every account is able to call this once
  /// @dev Will revert in case the amount is 0
  /// @dev SHER tokens will be sent to caller
  function claim() external {
    // Only allow claim calls if claim period is active
    if (active() == false) revert InvalidState();

    // How much SHER the user will receive
    uint256 amount = userClaims[msg.sender];
    // Dont proceed if it's 0 SHER
    if (amount == 0) revert InvalidAmount();
    // If it is not 0, make sure it's 0 next time the user calls this function
    delete userClaims[msg.sender];

    // Transfer SHER to user
    sher.safeTransfer(msg.sender, amount);

    // Emit event about the SHER claim
    emit Claim(msg.sender, amount);
  }
}

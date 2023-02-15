// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

interface ISherlockClaimManagerCallbackReceiver {
  /// @notice Calls this function on approved contracts and passes args
  /// @param _protocol The protocol that is receiving the payout
  /// @param _claimID The claim ID that is receiving the payout
  /// @param _amount The amount of USDC being paid out for this claim
  function PreCorePayoutCallback(
    bytes32 _protocol,
    uint256 _claimID,
    uint256 _amount
  ) external;
}

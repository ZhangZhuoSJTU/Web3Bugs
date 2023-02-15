// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/SherlockClaimManager.sol';

/// @notice this contract is used for testing to view all storage variables
contract SherlockClaimManagerTest is SherlockClaimManager {
  constructor(address _umaho, address _spcc) SherlockClaimManager(_umaho, _spcc) {}

  function viewPublicToInternalID(uint256 id) external view returns (bytes32) {
    return publicToInternalID[id];
  }

  function viewInternalToPublicID(bytes32 id) external view returns (uint256) {
    return internalToPublicID[id];
  }

  function viewClaims(bytes32 id) external view returns (Claim memory) {
    return claims_[id];
  }

  function viewLastClaimID() external view returns (uint256) {
    return lastClaimID;
  }

  function isPayoutState(State _oldState, uint256 updated) external view returns (bool) {
    return _isPayoutState(_oldState, updated);
  }

  function isEscalateState(State _oldState, uint256 updated) external view returns (bool) {
    return _isEscalateState(_oldState, updated);
  }

  function isCleanupState(State _oldState) external view returns (bool) {
    return _isCleanupState(_oldState);
  }

  function _setClaimUpdate(uint256 _claimID, uint256 _updated) external {
    claims_[publicToInternalID[_claimID]].updated = _updated;
  }
}

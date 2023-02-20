// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/SherlockProtocolManager.sol';

/// @notice this contract is used for testing to view all storage variables
contract SherlockProtocolManagerTest is SherlockProtocolManager {
  constructor(IERC20 _token) SherlockProtocolManager(_token) {}

  function privateSettleTotalDebt() external {
    _settleTotalDebt();
  }

  function privatesetMinActiveBalance(uint256 _min) external {
    minActiveBalance = _min;
  }

  function viewMinActiveBalance() external view returns (uint256) {
    return minActiveBalance;
  }

  function viewProtocolAgent(bytes32 _protocol) external view returns (address) {
    return protocolAgent_[_protocol];
  }

  function viewRemovedProtocolAgent(bytes32 _protocol) external view returns (address) {
    return removedProtocolAgent[_protocol];
  }

  function viewRemovedProtocolClaimDeadline(bytes32 _protocol) external view returns (uint256) {
    return removedProtocolClaimDeadline[_protocol];
  }

  function viewNonStakersPercentage(bytes32 _protocol) external view returns (uint256) {
    return nonStakersPercentage[_protocol];
  }

  function viewPremium(bytes32 _protocol) external view returns (uint256) {
    return premiums_[_protocol];
  }

  function viewCurrentCoverage(bytes32 _protocol) external view returns (uint256) {
    return currentCoverage[_protocol];
  }

  function viewPreviousCoverage(bytes32 _protocol) external view returns (uint256) {
    return previousCoverage[_protocol];
  }

  function viewLastAccountedEachProtocol(bytes32 _protocol) external view returns (uint256) {
    return lastAccountedEachProtocol[_protocol];
  }

  function viewNonStakersClaimableByProtocol(bytes32 _protocol) external view returns (uint256) {
    return nonStakersClaimableByProtocol[_protocol];
  }

  function viewLastAccountedGlobal() external view returns (uint256) {
    return lastAccountedGlobal;
  }

  function viewAllPremiumsPerSecToStakers() external view returns (uint256) {
    return allPremiumsPerSecToStakers;
  }

  function viewLastClaimablePremiumsForStakers() external view returns (uint256) {
    return lastClaimablePremiumsForStakers;
  }

  function viewActiveBalance(bytes32 _protocol) external view returns (uint256) {
    return activeBalances[_protocol];
  }

  function viewCalcForceRemoveBySecondsOfCoverage(bytes32 _protocol)
    external
    view
    returns (uint256, bool)
  {
    return _calcForceRemoveBySecondsOfCoverage(_protocol);
  }
}

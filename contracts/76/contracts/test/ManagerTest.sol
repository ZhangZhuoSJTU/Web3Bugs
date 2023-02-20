// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/Manager.sol';

/// @notice this contract is used for testing to view all storage variables
contract ManagerTest is Manager {
  function revertsIfNotCore() external onlySherlockCore {}

  function viewSherlockCore() external view returns (address) {
    return address(sherlockCore);
  }

  function sweep(address _receiver, IERC20[] memory _extraTokens) external {
    _sweep(_receiver, _extraTokens);
  }
}

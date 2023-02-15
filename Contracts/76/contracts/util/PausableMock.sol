// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/security/Pausable.sol';

contract PausableMock is Pausable {
  function pause() external {
    _pause();
  }

  function unpause() external {
    _unpause();
  }
}

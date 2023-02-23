// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../Pausable.sol";

contract PausableTest is Pausable {
  function testWhenNotPaused() external whenNotPaused {}
}

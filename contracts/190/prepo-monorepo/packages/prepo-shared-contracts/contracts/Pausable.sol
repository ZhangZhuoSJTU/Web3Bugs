// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./SafeOwnable.sol";
import "./interfaces/IPausable.sol";

contract Pausable is IPausable, SafeOwnable {
  bool private _paused;

  modifier whenNotPaused() {
    require(!_paused, "Paused");
    _;
  }

  constructor() {}

  function setPaused(bool _newPaused) external override onlyOwner {
    _paused = _newPaused;
    emit PausedChange(_newPaused);
  }

  function isPaused() external view override returns (bool) {
    return _paused;
  }
}

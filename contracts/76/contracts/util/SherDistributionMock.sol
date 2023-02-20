// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/Manager.sol';
import '../interfaces/managers/ISherDistributionManager.sol';

contract SherDistributionMock is ISherDistributionManager, Manager {
  uint256 reward;
  IERC20 token;
  IERC20 sher;

  uint256 public lastAmount;
  uint256 public lastPeriod;
  uint256 public value;

  bool public revertReward;

  constructor(IERC20 _token, IERC20 _sher) {
    token = _token;
    sher = _sher;

    value = type(uint256).max;
  }

  function setReward(uint256 _reward) external {
    reward = _reward;
  }

  function setRewardRevert(bool _revert) external {
    revertReward = _revert;
  }

  function setCustomRewardReturnValue(uint256 _value) external {
    value = _value;
  }

  function pullReward(
    uint256 _amount,
    uint256 _period,
    uint256 _id,
    address _receiver
  ) external override returns (uint256 _sher) {
    require(_amount != 0, 'ZERO');
    require(!revertReward, 'REV');
    _sher = reward;
    sher.transfer(msg.sender, reward);

    lastAmount = _amount;
    lastPeriod = _period;

    if (value != type(uint256).max) _sher = value;
  }

  function calcReward(
    uint256 _tvl,
    uint256 _amount,
    uint256 _period
  ) external view override returns (uint256 _sher) {}

  function isActive() external view override returns (bool) {}
}

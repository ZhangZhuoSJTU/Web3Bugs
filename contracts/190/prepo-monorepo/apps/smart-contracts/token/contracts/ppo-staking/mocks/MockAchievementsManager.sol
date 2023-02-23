// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import "../governance/staking/interfaces/IAchievementsManager.sol";

contract MockAchievementsManager is IAchievementsManager {
  constructor() {}

  function checkForSeasonFinish(address _account)
    external
    override
    returns (int64)
  {
    return 1e12;
  }
}

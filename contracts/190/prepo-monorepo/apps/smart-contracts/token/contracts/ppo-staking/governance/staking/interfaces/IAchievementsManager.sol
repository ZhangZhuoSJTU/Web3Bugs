// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * This interface is for mocking purposes until AchievementsManager is
 * complete. `checkForSeasonFinish()` is the only function that will be called
 * by the staking contract and therefore the only one we need to mock.
 */
interface IAchievementsManager {
  function checkForSeasonFinish(address account) external returns (int64);
}

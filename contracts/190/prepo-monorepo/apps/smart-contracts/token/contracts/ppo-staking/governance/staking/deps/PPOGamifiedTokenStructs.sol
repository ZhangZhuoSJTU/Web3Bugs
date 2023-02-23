// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

// TODO move to IPPOGamifiedToken

struct Balance {
  /// units of staking token that has been deposited and consequently wrapped
  uint128 raw;
  /// (block.timestamp - weightedTimestamp) represents the seconds a user has had their full raw balance wrapped.
  /// If they deposit or withdraw, the weightedTimestamp is dragged towards block.timestamp proportionately
  uint64 weightedTimestamp;
  /// multiplier awarded for staking for a long time
  uint64 timeMultiplier;
  /// TODO remove
  uint8 questMultiplier;
  /// multiplier obtained from AchievementsManager
  int64 achievementsMultiplier;
  /// Time at which the relative cooldown began
  uint64 cooldownTimestamp;
  /// Units up for cooldown
  uint128 cooldownUnits;
}

struct QuestBalance {
  /// last timestamp at which the user made a write action to this contract
  uint32 lastAction;
  /// permanent multiplier applied to an account, awarded for PERMANENT QuestTypes
  uint8 permMultiplier;
  /// multiplier that decays after each "season" (~9 months) by 75%, to avoid multipliers getting out of control
  uint8 seasonMultiplier;
}

/// @notice Quests can either give permanent rewards or only for the season
enum QuestType {
  PERMANENT,
  SEASONAL
}

/// @notice Quests can be turned off by the questMaster. All those who already completed remain
enum QuestStatus {
  ACTIVE,
  EXPIRED
}
struct Quest {
  /// Type of quest rewards
  QuestType model;
  /// Multiplier, from 1 == 1.01x to 100 == 2.00x
  uint8 multiplier;
  /// Is the current quest valid?
  QuestStatus status;
  /// Expiry date in seconds for the quest
  uint32 expiry;
}

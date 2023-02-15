// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "../Staker.sol";

/*
NOTE: This contract is for testing purposes only!
*/

contract StakerInternalStateSetters is Staker {
  ///////////////////////////////////////////////
  //////////// Test Helper Functions ////////////
  ///////////////////////////////////////////////
  // TODO: remove parts of this function that aren't necessary for the updated `_calculateAccumulatedFloat` funciton
  function setFloatRewardCalcParams(
    uint32 marketIndex,
    address longToken,
    address shortToken,
    uint256 newLatestRewardIndex,
    address user,
    uint256 usersLatestClaimedReward,
    uint256 accumulativeFloatPerTokenLatestLong,
    uint256 accumulativeFloatPerTokenLatestShort,
    uint256 accumulativeFloatPerTokenUserLong,
    uint256 accumulativeFloatPerTokenUserShort,
    uint256 newUserAmountStakedLong,
    uint256 newUserAmountStakedShort
  ) public {
    latestRewardIndex[marketIndex] = newLatestRewardIndex;
    userIndexOfLastClaimedReward[marketIndex][user] = usersLatestClaimedReward;
    syntheticTokens[marketIndex][true] = longToken;
    syntheticTokens[marketIndex][false] = shortToken;

    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][newLatestRewardIndex]
    .accumulativeFloatPerSyntheticToken_long = accumulativeFloatPerTokenLatestLong;

    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][usersLatestClaimedReward]
    .accumulativeFloatPerSyntheticToken_long = accumulativeFloatPerTokenUserLong;

    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][newLatestRewardIndex]
    .accumulativeFloatPerSyntheticToken_short = accumulativeFloatPerTokenLatestShort;

    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][usersLatestClaimedReward]
    .accumulativeFloatPerSyntheticToken_short = accumulativeFloatPerTokenUserShort;

    userAmountStaked[longToken][user] = newUserAmountStakedLong;
    userAmountStaked[shortToken][user] = newUserAmountStakedShort;
  }

  function setCalculateAccumulatedFloatInRangeGlobals(
    uint32 marketIndex,
    uint256 rewardIndexTo,
    uint256 rewardIndexFrom,
    uint256 syntheticRewardToLongToken,
    uint256 syntheticRewardFromLongToken,
    uint256 syntheticRewardToShortToken,
    uint256 syntheticRewardFromShortToken
  ) public {
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][rewardIndexTo]
    .accumulativeFloatPerSyntheticToken_long = syntheticRewardToLongToken;
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][rewardIndexTo]
    .accumulativeFloatPerSyntheticToken_short = syntheticRewardToShortToken;
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][rewardIndexFrom]
    .accumulativeFloatPerSyntheticToken_long = syntheticRewardFromLongToken;
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][rewardIndexFrom]
    .accumulativeFloatPerSyntheticToken_short = syntheticRewardFromShortToken;
  }

  function setShiftParams(
    uint32 marketIndex,
    address user,
    uint256 shiftAmountLong,
    uint256 shiftAmountShort,
    uint256 _userNextPrice_stakedSyntheticTokenShiftIndex,
    uint256 _batched_stakerNextTokenShiftIndex,
    uint256 _takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping,
    uint256 _stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping
  ) public {
    userNextPrice_stakedSyntheticTokenShiftIndex[marketIndex][user] = _userNextPrice_stakedSyntheticTokenShiftIndex;
    userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long[marketIndex][user] = shiftAmountLong;
    userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short[marketIndex][user] = shiftAmountShort;
    batched_stakerNextTokenShiftIndex[marketIndex] = _batched_stakerNextTokenShiftIndex;
    stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping[
      _userNextPrice_stakedSyntheticTokenShiftIndex
    ] = _takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping;
    stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping[
      _userNextPrice_stakedSyntheticTokenShiftIndex
    ] = _stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping;
  }

  function setShiftTokensParams(
    uint32 marketIndex,
    bool isShiftFromLong,
    address user,
    uint256 amountSyntheticTokensToShift,
    uint256 _userAmountStaked,
    uint256 _userNextPrice_stakedSyntheticTokenShiftIndex,
    uint256 _batched_stakerNextTokenShiftIndex,
    address syntheticToken
  ) public {
    userNextPrice_stakedSyntheticTokenShiftIndex[marketIndex][user] = _userNextPrice_stakedSyntheticTokenShiftIndex;
    batched_stakerNextTokenShiftIndex[marketIndex] = _batched_stakerNextTokenShiftIndex;

    if (isShiftFromLong) {
      userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long[marketIndex][user] = amountSyntheticTokensToShift;
    } else {
      userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short[marketIndex][user] = amountSyntheticTokensToShift;
    }

    syntheticTokens[marketIndex][isShiftFromLong] = syntheticToken;
    userAmountStaked[syntheticToken][user] = _userAmountStaked;
  }

  function setLongShort(address _longShort) public {
    longShort = _longShort;
  }

  function setAddNewStakingFundParams(
    uint32 marketIndex,
    address longToken,
    address shortToken,
    address mockAddress,
    address longShortAddress
  ) public {
    longShort = address(longShortAddress);
    marketIndexOfToken[longToken] = marketIndex;
    marketIndexOfToken[shortToken] = marketIndex;

    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][0].timestamp = 0; // don't test with 0
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][0].accumulativeFloatPerSyntheticToken_long = 1;
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][0].accumulativeFloatPerSyntheticToken_short = 1;

    syntheticTokens[marketIndex][true] = mockAddress;
    syntheticTokens[marketIndex][false] = mockAddress;
  }

  function setAddNewStateForFloatRewardsGlobals(
    uint32 marketIndex,
    uint256 _batched_stakerNextTokenShiftIndex,
    uint256 _latestRewardIndex
  ) external {
    batched_stakerNextTokenShiftIndex[marketIndex] = _batched_stakerNextTokenShiftIndex;
    latestRewardIndex[marketIndex] = _latestRewardIndex;
  }

  function setGetMarketLaunchIncentiveParametersParams(
    uint32 marketIndex,
    uint256 period,
    uint256 multiplier
  ) external {
    marketLaunchIncentive_period[marketIndex] = period;
    marketLaunchIncentive_multipliers[marketIndex] = multiplier;
  }

  function setGetKValueParams(uint32 marketIndex, uint256 timestamp) external {
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][0].timestamp = timestamp;
  }

  function setStakeFromUserParams(
    address longshort,
    address token,
    uint32 marketIndexForToken
  ) external {
    longShort = address(longshort);
    marketIndexOfToken[token] = marketIndexForToken;
  }

  function setCalculateTimeDeltaParams(
    uint32 marketIndex,
    uint256 latestRewardIndexForMarket,
    uint256 timestamp
  ) external {
    latestRewardIndex[marketIndex] = latestRewardIndexForMarket;
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][latestRewardIndexForMarket].timestamp = timestamp;
  }

  function setCalculateNewCumulativeRateParams(
    uint32 marketIndex,
    uint256 latestRewardIndexForMarket,
    uint256 accumFloatLong,
    uint256 accumFloatShort
  ) external {
    latestRewardIndex[marketIndex] = latestRewardIndexForMarket;
    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][latestRewardIndex[marketIndex]]
    .accumulativeFloatPerSyntheticToken_long = accumFloatLong;

    accumulativeFloatPerSyntheticTokenSnapshots[marketIndex][latestRewardIndex[marketIndex]]
    .accumulativeFloatPerSyntheticToken_short = accumFloatShort;
  }

  function setSetRewardObjectsParams(uint32 marketIndex, uint256 latestRewardIndexForMarket) external {
    latestRewardIndex[marketIndex] = latestRewardIndexForMarket;
  }

  function set_updateStateParams(
    address _longShort,
    address token,
    uint32 tokenMarketIndex
  ) public {
    longShort = _longShort;
    marketIndexOfToken[token] = tokenMarketIndex;
  }

  function set_mintFloatParams(address _floatToken, uint16 _floatPercentage) public {
    floatToken = _floatToken;
    floatPercentage = _floatPercentage;
  }

  function setMintAccumulatedFloatAndClaimFloatParams(uint32 marketIndex, uint256 latestRewardIndexForMarket) public {
    latestRewardIndex[marketIndex] = latestRewardIndexForMarket;
  }

  function set_stakeParams(
    address user,
    uint32 marketIndex,
    uint256 _latestRewardIndex,
    address token,
    uint256 _userAmountStaked,
    uint256 userLastRewardIndex
  ) external {
    marketIndexOfToken[token] = marketIndex;
    latestRewardIndex[marketIndex] = _latestRewardIndex;
    userAmountStaked[token][user] = _userAmountStaked;
    userIndexOfLastClaimedReward[marketIndex][user] = userLastRewardIndex;
  }

  function set_withdrawGlobals(
    uint32 marketIndex,
    address syntheticToken,
    address user,
    uint256 amountStaked,
    uint256 fees,
    address treasury
  ) external {
    marketIndexOfToken[syntheticToken] = marketIndex;
    marketUnstakeFee_e18[marketIndex] = fees;
    userAmountStaked[syntheticToken][user] = amountStaked;
    floatTreasury = treasury;
  }

  function setWithdrawGlobals(
    uint32 marketIndex,
    address _longShort,
    address token
  ) external {
    marketIndexOfToken[token] = marketIndex;
    longShort = _longShort;
  }

  function setWithdrawAllGlobals(
    uint32 marketIndex,
    address _longShort,
    address user,
    uint256 amountStaked,
    address token
  ) external {
    marketIndexOfToken[token] = marketIndex;
    longShort = _longShort;
    userAmountStaked[token][user] = amountStaked;
  }

  function setEquilibriumOffset(uint32 marketIndex, int256 _balanceIncentiveCurve_equilibriumOffset) external {
    balanceIncentiveCurve_equilibriumOffset[marketIndex] = _balanceIncentiveCurve_equilibriumOffset;
  }

  ///////////////////////////////////////////////////////
  //////////// Functions for Experimentation ////////////
  ///////////////////////////////////////////////////////

  function getRequiredAmountOfBitShiftForSafeExponentiationPerfect(uint256 number, uint256 exponent)
    external
    pure
    returns (uint256 amountOfBitShiftRequired)
  {
    uint256 targetMaxNumberSizeBinaryDigits = 257 / exponent;

    // Note this can be optimised, this gets a quick easy to compute safe upper bound, not the actuall upper bound.
    uint256 targetMaxNumber = 2**targetMaxNumberSizeBinaryDigits;

    while (number >> amountOfBitShiftRequired > targetMaxNumber) {
      ++amountOfBitShiftRequired;
    }
  }
}

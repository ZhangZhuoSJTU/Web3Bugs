pragma solidity 0.8.3;

import "../LongShort.sol";

/*
NOTE: This contract is for testing purposes only!
*/

contract LongShortInternalStateSetters is LongShort {
  bool overRideexecuteOutstandingNextPriceSettlements;

  event executeOutstandingNextPriceSettlementsMock(address _user, uint32 _marketIndex);

  function setInitializeMarketParams(
    uint32 marketIndex,
    bool marketIndexValue,
    uint32 _latestMarket,
    address _staker,
    address longAddress,
    address shortAddress
  ) public {
    latestMarket = _latestMarket;
    marketExists[marketIndex] = marketIndexValue;
    staker = (_staker);
    syntheticTokens[marketIndex][
      true /*short*/
    ] = (longAddress);
    syntheticTokens[marketIndex][
      false /*short*/
    ] = (shortAddress);
  }

  function setMarketExistsMulti(uint32[] calldata marketIndexes) external {
    for (uint256 i = 0; i < marketIndexes.length; i++) {
      marketExists[marketIndexes[i]] = true;
    }
  }

  function set_updateSystemStateInternalGlobals(
    uint32 marketIndex,
    uint256 _latestUpdateIndexForMarket,
    uint256 syntheticTokenPrice_inPaymentTokens_long,
    uint256 syntheticTokenPrice_inPaymentTokens_short,
    uint256 _assetPrice,
    uint256 longValue,
    uint256 shortValue,
    address oracleManager,
    address _staker,
    address synthLong,
    address synthShort,
    uint256 stakerNextPrice_currentUpdateIndex
  ) public {
    marketExists[marketIndex] = true;
    marketUpdateIndex[marketIndex] = _latestUpdateIndexForMarket;
    syntheticToken_priceSnapshot[marketIndex][true][
      _latestUpdateIndexForMarket
    ] = syntheticTokenPrice_inPaymentTokens_long;
    syntheticToken_priceSnapshot[marketIndex][false][
      _latestUpdateIndexForMarket
    ] = syntheticTokenPrice_inPaymentTokens_short;

    marketSideValueInPaymentToken[marketIndex][true] = longValue;
    marketSideValueInPaymentToken[marketIndex][false] = shortValue;

    assetPrice[marketIndex] = _assetPrice;
    oracleManagers[marketIndex] = oracleManager;

    syntheticTokens[marketIndex][true] = synthLong;
    syntheticTokens[marketIndex][false] = synthShort;

    staker = _staker;

    userNextPrice_currentUpdateIndex[marketIndex][_staker] = stakerNextPrice_currentUpdateIndex;
  }

  function setUseexecuteOutstandingNextPriceSettlementsMock(bool shouldUseMock) public {
    overRideexecuteOutstandingNextPriceSettlements = shouldUseMock;
  }

  function _executeOutstandingNextPriceSettlementsMock(address _user, uint32 _marketIndex) internal {
    emit executeOutstandingNextPriceSettlementsMock(_user, _marketIndex);
  }

  function _executeOutstandingNextPriceSettlementsExposedWithEvent(address user, uint32 marketIndex) external {
    _executeOutstandingNextPriceSettlements(user, marketIndex);
  }

  function setGetUsersConfirmedButNotSettledBalanceGlobals(
    uint32 marketIndex,
    address user,
    bool isLong,
    uint256 _userNextPrice_currentUpdateIndex,
    uint256 _marketUpdateIndex,
    uint256 _userNextPrice_paymentToken_depositAmount_isLong,
    uint256 _syntheticToken_priceSnapshot_isLong,
    uint256 _syntheticToken_priceSnapshot_notIsLong,
    uint256 _userNextPrice_syntheticToken_toShiftAwayFrom_marketSide_notIsLong
  ) external {
    marketExists[marketIndex] = true;
    userNextPrice_currentUpdateIndex[marketIndex][user] = _userNextPrice_currentUpdateIndex;
    marketUpdateIndex[marketIndex] = _marketUpdateIndex;

    userNextPrice_paymentToken_depositAmount[marketIndex][isLong][
      user
    ] = _userNextPrice_paymentToken_depositAmount_isLong;
    userNextPrice_paymentToken_depositAmount[marketIndex][!isLong][user] = 0; // reset other side for good measure

    syntheticToken_priceSnapshot[marketIndex][isLong][_marketUpdateIndex] = _syntheticToken_priceSnapshot_isLong;
    syntheticToken_priceSnapshot[marketIndex][!isLong][_marketUpdateIndex] = _syntheticToken_priceSnapshot_notIsLong;

    userNextPrice_syntheticToken_toShiftAwayFrom_marketSide[marketIndex][!isLong][
      user
    ] = _userNextPrice_syntheticToken_toShiftAwayFrom_marketSide_notIsLong;
    userNextPrice_syntheticToken_toShiftAwayFrom_marketSide[marketIndex][isLong][user] = 0; // reset other side for good measure
  }

  function setPerformOustandingBatchedSettlementsGlobals(
    uint32 marketIndex,
    uint256 batched_amountPaymentToken_depositLong,
    uint256 batched_amountPaymentToken_depositShort,
    uint256 batched_amountSyntheticToken_redeemLong,
    uint256 batched_amountSyntheticToken_redeemShort,
    uint256 batchedAmountSyntheticTokenToShiftFromLong,
    uint256 batchedAmountSyntheticTokenToShiftFromShort
  ) external {
    batched_amountPaymentToken_deposit[marketIndex][true] = batched_amountPaymentToken_depositLong;
    batched_amountPaymentToken_deposit[marketIndex][false] = batched_amountPaymentToken_depositShort;
    batched_amountSyntheticToken_redeem[marketIndex][true] = batched_amountSyntheticToken_redeemLong;
    batched_amountSyntheticToken_redeem[marketIndex][false] = batched_amountSyntheticToken_redeemShort;
    batched_amountSyntheticToken_toShiftAwayFrom_marketSide[marketIndex][
      true
    ] = batchedAmountSyntheticTokenToShiftFromLong;
    batched_amountSyntheticToken_toShiftAwayFrom_marketSide[marketIndex][
      false
    ] = batchedAmountSyntheticTokenToShiftFromShort;
  }

  function setHandleChangeInSyntheticTokensTotalSupplyGlobals(
    uint32 marketIndex,
    address longSyntheticToken,
    address shortSyntheticToken
  ) external {
    syntheticTokens[marketIndex][true] = longSyntheticToken;
    syntheticTokens[marketIndex][false] = shortSyntheticToken;
  }

  function setHandleTotalValueChangeForMarketWithYieldManagerGlobals(uint32 marketIndex, address yieldManager)
    external
  {
    yieldManagers[marketIndex] = yieldManager;
  }

  function setMintNextPriceGlobals(uint32 marketIndex, uint256 _marketUpdateIndex) external {
    marketUpdateIndex[marketIndex] = _marketUpdateIndex;
  }

  function setRedeemNextPriceGlobals(
    uint32 marketIndex,
    uint256 _marketUpdateIndex,
    address syntheticToken,
    bool isLong
  ) external {
    marketUpdateIndex[marketIndex] = _marketUpdateIndex;
    syntheticTokens[marketIndex][isLong] = syntheticToken;
  }

  function setShiftNextPriceGlobals(
    uint32 marketIndex,
    uint256 _marketUpdateIndex,
    address syntheticTokenShiftedFrom,
    bool isShiftFromLong
  ) external {
    marketUpdateIndex[marketIndex] = _marketUpdateIndex;
    syntheticTokens[marketIndex][isShiftFromLong] = syntheticTokenShiftedFrom;
  }

  function setExecuteOutstandingNextPriceMintsGlobals(
    uint32 marketIndex,
    address user,
    bool isLong,
    address syntheticToken,
    uint256 _userNextPrice_syntheticToken_redeemAmount,
    uint256 _userNextPrice_currentUpdateIndex,
    uint256 _syntheticToken_priceSnapshot
  ) external {
    userNextPrice_paymentToken_depositAmount[marketIndex][isLong][user] = _userNextPrice_syntheticToken_redeemAmount;
    userNextPrice_currentUpdateIndex[marketIndex][user] = _userNextPrice_currentUpdateIndex;
    syntheticToken_priceSnapshot[marketIndex][isLong][
      _userNextPrice_currentUpdateIndex
    ] = _syntheticToken_priceSnapshot;
    syntheticTokens[marketIndex][isLong] = syntheticToken;
  }

  function setExecuteOutstandingNextPriceRedeemsGlobals(
    uint32 marketIndex,
    address user,
    bool isLong,
    address yieldManager,
    uint256 _userNextPrice_syntheticToken_redeemAmount,
    uint256 _userNextPrice_currentUpdateIndex,
    uint256 _syntheticToken_priceSnapshot
  ) external {
    userNextPrice_syntheticToken_redeemAmount[marketIndex][isLong][user] = _userNextPrice_syntheticToken_redeemAmount;
    userNextPrice_currentUpdateIndex[marketIndex][user] = _userNextPrice_currentUpdateIndex;
    syntheticToken_priceSnapshot[marketIndex][isLong][
      _userNextPrice_currentUpdateIndex
    ] = _syntheticToken_priceSnapshot;
    yieldManagers[marketIndex] = yieldManager;
  }

  function setExecuteOutstandingNextPriceTokenShiftsGlobals(
    uint32 marketIndex,
    address user,
    bool isShiftFromLong,
    address syntheticTokenShiftedTo,
    uint256 _userNextPrice_syntheticToken_toShiftAwayFrom_marketSide,
    uint256 _userNextPrice_currentUpdateIndex,
    uint256 _syntheticToken_priceSnapshotShiftedFrom,
    uint256 _syntheticToken_priceSnapshotShiftedTo
  ) external {
    userNextPrice_syntheticToken_toShiftAwayFrom_marketSide[marketIndex][isShiftFromLong][
      user
    ] = _userNextPrice_syntheticToken_toShiftAwayFrom_marketSide;
    userNextPrice_currentUpdateIndex[marketIndex][user] = _userNextPrice_currentUpdateIndex;
    syntheticToken_priceSnapshot[marketIndex][isShiftFromLong][
      _userNextPrice_currentUpdateIndex
    ] = _syntheticToken_priceSnapshotShiftedFrom;
    syntheticToken_priceSnapshot[marketIndex][!isShiftFromLong][
      _userNextPrice_currentUpdateIndex
    ] = _syntheticToken_priceSnapshotShiftedTo;
    syntheticTokens[marketIndex][!isShiftFromLong] = syntheticTokenShiftedTo;
  }

  function setExecuteOutstandingNextPriceSettlementsGlobals(
    uint32 marketIndex,
    address user,
    uint256 _userNextPrice_currentUpdateIndex,
    uint256 _marketUpdateIndex
  ) external {
    userNextPrice_currentUpdateIndex[marketIndex][user] = _userNextPrice_currentUpdateIndex;
    marketUpdateIndex[marketIndex] = _marketUpdateIndex;
  }

  function setClaimAndDistributeYieldThenRebalanceMarketGlobals(
    uint32 marketIndex,
    uint256 _marketSideValueInPaymentTokenLong,
    uint256 _marketSideValueInPaymentTokenShort,
    address yieldManager
  ) external {
    marketSideValueInPaymentToken[marketIndex][true] = _marketSideValueInPaymentTokenLong;
    marketSideValueInPaymentToken[marketIndex][false] = _marketSideValueInPaymentTokenShort;
    yieldManagers[marketIndex] = yieldManager;
  }

  function setDepositFundsGlobals(
    uint32 marketIndex,
    address paymentToken,
    address yieldManager
  ) external {
    paymentTokens[marketIndex] = paymentToken;
    yieldManagers[marketIndex] = yieldManager;
  }

  function setLockFundsInMarketGlobals(uint32 marketIndex, address yieldManager) external {
    yieldManagers[marketIndex] = yieldManager;
  }
}

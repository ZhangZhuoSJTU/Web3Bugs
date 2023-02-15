type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: Staker.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockFLOAT_ISSUANCE_FIXED_DECIMALToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.FLOAT_ISSUANCE_FIXED_DECIMAL.will.return.with([_param0])")
}

type fLOAT_ISSUANCE_FIXED_DECIMALCall

let fLOAT_ISSUANCE_FIXED_DECIMALCalls: t => array<fLOAT_ISSUANCE_FIXED_DECIMALCall> = _r => {
  let array = %raw("_r.smocked.FLOAT_ISSUANCE_FIXED_DECIMAL.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockAccumulativeFloatPerSyntheticTokenSnapshotsToReturn: (
  t,
  Ethers.BigNumber.t,
  Ethers.BigNumber.t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0, _param1, _param2) => {
  let _ = %raw(
    "_r.smocked.accumulativeFloatPerSyntheticTokenSnapshots.will.return.with([_param0,_param1,_param2])"
  )
}

type accumulativeFloatPerSyntheticTokenSnapshotsCall = {
  param0: int,
  param1: Ethers.BigNumber.t,
}

let accumulativeFloatPerSyntheticTokenSnapshotsCalls: t => array<
  accumulativeFloatPerSyntheticTokenSnapshotsCall,
> = _r => {
  let array = %raw("_r.smocked.accumulativeFloatPerSyntheticTokenSnapshots.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockAddNewStakingFundToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.addNewStakingFund.will.return()")
}

type addNewStakingFundCall = {
  marketIndex: int,
  longToken: Ethers.ethAddress,
  shortToken: Ethers.ethAddress,
  kInitialMultiplier: Ethers.BigNumber.t,
  kPeriod: Ethers.BigNumber.t,
  unstakeFee_e18: Ethers.BigNumber.t,
  balanceIncentiveCurve_exponent: Ethers.BigNumber.t,
  balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
}

let addNewStakingFundCalls: t => array<addNewStakingFundCall> = _r => {
  let array = %raw("_r.smocked.addNewStakingFund.calls")
  array->Array.map(((
    marketIndex,
    longToken,
    shortToken,
    kInitialMultiplier,
    kPeriod,
    unstakeFee_e18,
    balanceIncentiveCurve_exponent,
    balanceIncentiveCurve_equilibriumOffset,
  )) => {
    {
      marketIndex: marketIndex,
      longToken: longToken,
      shortToken: shortToken,
      kInitialMultiplier: kInitialMultiplier,
      kPeriod: kPeriod,
      unstakeFee_e18: unstakeFee_e18,
      balanceIncentiveCurve_exponent: balanceIncentiveCurve_exponent,
      balanceIncentiveCurve_equilibriumOffset: balanceIncentiveCurve_equilibriumOffset,
    }
  })
}

let mockAdminToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.admin.will.return.with([_param0])")
}

type adminCall

let adminCalls: t => array<adminCall> = _r => {
  let array = %raw("_r.smocked.admin.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockBalanceIncentiveCurve_equilibriumOffsetToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.balanceIncentiveCurve_equilibriumOffset.will.return.with([_param0])")
}

type balanceIncentiveCurve_equilibriumOffsetCall = {param0: int}

let balanceIncentiveCurve_equilibriumOffsetCalls: t => array<
  balanceIncentiveCurve_equilibriumOffsetCall,
> = _r => {
  let array = %raw("_r.smocked.balanceIncentiveCurve_equilibriumOffset.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockBalanceIncentiveCurve_exponentToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.balanceIncentiveCurve_exponent.will.return.with([_param0])")
}

type balanceIncentiveCurve_exponentCall = {param0: int}

let balanceIncentiveCurve_exponentCalls: t => array<balanceIncentiveCurve_exponentCall> = _r => {
  let array = %raw("_r.smocked.balanceIncentiveCurve_exponent.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockBatched_stakerNextTokenShiftIndexToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.batched_stakerNextTokenShiftIndex.will.return.with([_param0])")
}

type batched_stakerNextTokenShiftIndexCall = {param0: int}

let batched_stakerNextTokenShiftIndexCalls: t => array<
  batched_stakerNextTokenShiftIndexCall,
> = _r => {
  let array = %raw("_r.smocked.batched_stakerNextTokenShiftIndex.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockChangeAdminToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeAdmin.will.return()")
}

type changeAdminCall = {admin: Ethers.ethAddress}

let changeAdminCalls: t => array<changeAdminCall> = _r => {
  let array = %raw("_r.smocked.changeAdmin.calls")
  array->Array.map(_m => {
    let admin = _m->Array.getUnsafe(0)

    {
      admin: admin,
    }
  })
}

let mockChangeBalanceIncentiveEquilibriumOffsetToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeBalanceIncentiveEquilibriumOffset.will.return()")
}

type changeBalanceIncentiveEquilibriumOffsetCall = {
  marketIndex: int,
  balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
}

let changeBalanceIncentiveEquilibriumOffsetCalls: t => array<
  changeBalanceIncentiveEquilibriumOffsetCall,
> = _r => {
  let array = %raw("_r.smocked.changeBalanceIncentiveEquilibriumOffset.calls")
  array->Array.map(((marketIndex, balanceIncentiveCurve_equilibriumOffset)) => {
    {
      marketIndex: marketIndex,
      balanceIncentiveCurve_equilibriumOffset: balanceIncentiveCurve_equilibriumOffset,
    }
  })
}

let mockChangeBalanceIncentiveExponentToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeBalanceIncentiveExponent.will.return()")
}

type changeBalanceIncentiveExponentCall = {
  marketIndex: int,
  balanceIncentiveCurve_exponent: Ethers.BigNumber.t,
}

let changeBalanceIncentiveExponentCalls: t => array<changeBalanceIncentiveExponentCall> = _r => {
  let array = %raw("_r.smocked.changeBalanceIncentiveExponent.calls")
  array->Array.map(((marketIndex, balanceIncentiveCurve_exponent)) => {
    {
      marketIndex: marketIndex,
      balanceIncentiveCurve_exponent: balanceIncentiveCurve_exponent,
    }
  })
}

let mockChangeFloatPercentageToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeFloatPercentage.will.return()")
}

type changeFloatPercentageCall = {newFloatPercentage: Ethers.BigNumber.t}

let changeFloatPercentageCalls: t => array<changeFloatPercentageCall> = _r => {
  let array = %raw("_r.smocked.changeFloatPercentage.calls")
  array->Array.map(_m => {
    let newFloatPercentage = _m->Array.getUnsafe(0)

    {
      newFloatPercentage: newFloatPercentage,
    }
  })
}

let mockChangeMarketLaunchIncentiveParametersToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeMarketLaunchIncentiveParameters.will.return()")
}

type changeMarketLaunchIncentiveParametersCall = {
  marketIndex: int,
  period: Ethers.BigNumber.t,
  initialMultiplier: Ethers.BigNumber.t,
}

let changeMarketLaunchIncentiveParametersCalls: t => array<
  changeMarketLaunchIncentiveParametersCall,
> = _r => {
  let array = %raw("_r.smocked.changeMarketLaunchIncentiveParameters.calls")
  array->Array.map(((marketIndex, period, initialMultiplier)) => {
    {
      marketIndex: marketIndex,
      period: period,
      initialMultiplier: initialMultiplier,
    }
  })
}

let mockChangeUnstakeFeeToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeUnstakeFee.will.return()")
}

type changeUnstakeFeeCall = {
  marketIndex: int,
  newMarketUnstakeFee_e18: Ethers.BigNumber.t,
}

let changeUnstakeFeeCalls: t => array<changeUnstakeFeeCall> = _r => {
  let array = %raw("_r.smocked.changeUnstakeFee.calls")
  array->Array.map(((marketIndex, newMarketUnstakeFee_e18)) => {
    {
      marketIndex: marketIndex,
      newMarketUnstakeFee_e18: newMarketUnstakeFee_e18,
    }
  })
}

let mockClaimFloatCustomToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.claimFloatCustom.will.return()")
}

type claimFloatCustomCall = {marketIndexes: array<int>}

let claimFloatCustomCalls: t => array<claimFloatCustomCall> = _r => {
  let array = %raw("_r.smocked.claimFloatCustom.calls")
  array->Array.map(_m => {
    let marketIndexes = _m->Array.getUnsafe(0)

    {
      marketIndexes: marketIndexes,
    }
  })
}

let mockClaimFloatCustomForToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.claimFloatCustomFor.will.return()")
}

type claimFloatCustomForCall = {
  marketIndexes: array<int>,
  user: Ethers.ethAddress,
}

let claimFloatCustomForCalls: t => array<claimFloatCustomForCall> = _r => {
  let array = %raw("_r.smocked.claimFloatCustomFor.calls")
  array->Array.map(((marketIndexes, user)) => {
    {
      marketIndexes: marketIndexes,
      user: user,
    }
  })
}

let mockFloatCapitalToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.floatCapital.will.return.with([_param0])")
}

type floatCapitalCall

let floatCapitalCalls: t => array<floatCapitalCall> = _r => {
  let array = %raw("_r.smocked.floatCapital.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockFloatPercentageToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.floatPercentage.will.return.with([_param0])")
}

type floatPercentageCall

let floatPercentageCalls: t => array<floatPercentageCall> = _r => {
  let array = %raw("_r.smocked.floatPercentage.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockFloatTokenToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.floatToken.will.return.with([_param0])")
}

type floatTokenCall

let floatTokenCalls: t => array<floatTokenCall> = _r => {
  let array = %raw("_r.smocked.floatToken.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockFloatTreasuryToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.floatTreasury.will.return.with([_param0])")
}

type floatTreasuryCall

let floatTreasuryCalls: t => array<floatTreasuryCall> = _r => {
  let array = %raw("_r.smocked.floatTreasury.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockInitializeToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.initialize.will.return()")
}

type initializeCall = {
  admin: Ethers.ethAddress,
  longShort: Ethers.ethAddress,
  floatToken: Ethers.ethAddress,
  floatTreasury: Ethers.ethAddress,
  floatCapital: Ethers.ethAddress,
  floatPercentage: Ethers.BigNumber.t,
}

let initializeCalls: t => array<initializeCall> = _r => {
  let array = %raw("_r.smocked.initialize.calls")
  array->Array.map(((
    admin,
    longShort,
    floatToken,
    floatTreasury,
    floatCapital,
    floatPercentage,
  )) => {
    {
      admin: admin,
      longShort: longShort,
      floatToken: floatToken,
      floatTreasury: floatTreasury,
      floatCapital: floatCapital,
      floatPercentage: floatPercentage,
    }
  })
}

let mockLatestRewardIndexToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.latestRewardIndex.will.return.with([_param0])")
}

type latestRewardIndexCall = {param0: int}

let latestRewardIndexCalls: t => array<latestRewardIndexCall> = _r => {
  let array = %raw("_r.smocked.latestRewardIndex.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockLongShortToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.longShort.will.return.with([_param0])")
}

type longShortCall

let longShortCalls: t => array<longShortCall> = _r => {
  let array = %raw("_r.smocked.longShort.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockMarketIndexOfTokenToReturn: (t, int) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.marketIndexOfToken.will.return.with([_param0])")
}

type marketIndexOfTokenCall = {param0: Ethers.ethAddress}

let marketIndexOfTokenCalls: t => array<marketIndexOfTokenCall> = _r => {
  let array = %raw("_r.smocked.marketIndexOfToken.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockMarketLaunchIncentive_multipliersToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.marketLaunchIncentive_multipliers.will.return.with([_param0])")
}

type marketLaunchIncentive_multipliersCall = {param0: int}

let marketLaunchIncentive_multipliersCalls: t => array<
  marketLaunchIncentive_multipliersCall,
> = _r => {
  let array = %raw("_r.smocked.marketLaunchIncentive_multipliers.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockMarketLaunchIncentive_periodToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.marketLaunchIncentive_period.will.return.with([_param0])")
}

type marketLaunchIncentive_periodCall = {param0: int}

let marketLaunchIncentive_periodCalls: t => array<marketLaunchIncentive_periodCall> = _r => {
  let array = %raw("_r.smocked.marketLaunchIncentive_period.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockMarketUnstakeFee_e18ToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.marketUnstakeFee_e18.will.return.with([_param0])")
}

type marketUnstakeFee_e18Call = {param0: int}

let marketUnstakeFee_e18Calls: t => array<marketUnstakeFee_e18Call> = _r => {
  let array = %raw("_r.smocked.marketUnstakeFee_e18.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockPushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations.will.return()")
}

type pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsCall = {
  marketIndex: int,
  longPrice: Ethers.BigNumber.t,
  shortPrice: Ethers.BigNumber.t,
  longValue: Ethers.BigNumber.t,
  shortValue: Ethers.BigNumber.t,
  stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted: Ethers.BigNumber.t,
}

let pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsCalls: t => array<
  pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsCall,
> = _r => {
  let array = %raw("_r.smocked.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations.calls")
  array->Array.map(((
    marketIndex,
    longPrice,
    shortPrice,
    longValue,
    shortValue,
    stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted,
  )) => {
    {
      marketIndex: marketIndex,
      longPrice: longPrice,
      shortPrice: shortPrice,
      longValue: longValue,
      shortValue: shortValue,
      stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted: stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted,
    }
  })
}

let mockSafeExponentBitShiftingToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.safeExponentBitShifting.will.return.with([_param0])")
}

type safeExponentBitShiftingCall

let safeExponentBitShiftingCalls: t => array<safeExponentBitShiftingCall> = _r => {
  let array = %raw("_r.smocked.safeExponentBitShifting.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockShiftTokensToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.shiftTokens.will.return()")
}

type shiftTokensCall = {
  amountSyntheticTokensToShift: Ethers.BigNumber.t,
  marketIndex: int,
  isShiftFromLong: bool,
}

let shiftTokensCalls: t => array<shiftTokensCall> = _r => {
  let array = %raw("_r.smocked.shiftTokens.calls")
  array->Array.map(((amountSyntheticTokensToShift, marketIndex, isShiftFromLong)) => {
    {
      amountSyntheticTokensToShift: amountSyntheticTokensToShift,
      marketIndex: marketIndex,
      isShiftFromLong: isShiftFromLong,
    }
  })
}

let mockStakeFromUserToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.stakeFromUser.will.return()")
}

type stakeFromUserCall = {
  from: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let stakeFromUserCalls: t => array<stakeFromUserCall> = _r => {
  let array = %raw("_r.smocked.stakeFromUser.calls")
  array->Array.map(((from, amount)) => {
    {
      from: from,
      amount: amount,
    }
  })
}

let mockStakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingToReturn: (
  t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0) => {
  let _ = %raw(
    "_r.smocked.stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping.will.return.with([_param0])"
  )
}

type stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingCall = {
  param0: Ethers.BigNumber.t,
}

let stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingCalls: t => array<
  stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingCall,
> = _r => {
  let array = %raw(
    "_r.smocked.stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping.calls"
  )
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockStakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingToReturn: (
  t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0) => {
  let _ = %raw(
    "_r.smocked.stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping.will.return.with([_param0])"
  )
}

type stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingCall = {
  param0: Ethers.BigNumber.t,
}

let stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingCalls: t => array<
  stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingCall,
> = _r => {
  let array = %raw(
    "_r.smocked.stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping.calls"
  )
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockSyntheticTokensToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.syntheticTokens.will.return.with([_param0])")
}

type syntheticTokensCall = {
  param0: int,
  param1: bool,
}

let syntheticTokensCalls: t => array<syntheticTokensCall> = _r => {
  let array = %raw("_r.smocked.syntheticTokens.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockUserAmountStakedToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.userAmountStaked.will.return.with([_param0])")
}

type userAmountStakedCall = {
  param0: Ethers.ethAddress,
  param1: Ethers.ethAddress,
}

let userAmountStakedCalls: t => array<userAmountStakedCall> = _r => {
  let array = %raw("_r.smocked.userAmountStaked.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockUserIndexOfLastClaimedRewardToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.userIndexOfLastClaimedReward.will.return.with([_param0])")
}

type userIndexOfLastClaimedRewardCall = {
  param0: int,
  param1: Ethers.ethAddress,
}

let userIndexOfLastClaimedRewardCalls: t => array<userIndexOfLastClaimedRewardCall> = _r => {
  let array = %raw("_r.smocked.userIndexOfLastClaimedReward.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockUserNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longToReturn: (
  t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0) => {
  let _ = %raw(
    "_r.smocked.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long.will.return.with([_param0])"
  )
}

type userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longCall = {
  param0: int,
  param1: Ethers.ethAddress,
}

let userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longCalls: t => array<
  userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longCall,
> = _r => {
  let array = %raw("_r.smocked.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockUserNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortToReturn: (
  t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0) => {
  let _ = %raw(
    "_r.smocked.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short.will.return.with([_param0])"
  )
}

type userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortCall = {
  param0: int,
  param1: Ethers.ethAddress,
}

let userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortCalls: t => array<
  userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortCall,
> = _r => {
  let array = %raw(
    "_r.smocked.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short.calls"
  )
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockUserNextPrice_stakedSyntheticTokenShiftIndexToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw(
    "_r.smocked.userNextPrice_stakedSyntheticTokenShiftIndex.will.return.with([_param0])"
  )
}

type userNextPrice_stakedSyntheticTokenShiftIndexCall = {
  param0: int,
  param1: Ethers.ethAddress,
}

let userNextPrice_stakedSyntheticTokenShiftIndexCalls: t => array<
  userNextPrice_stakedSyntheticTokenShiftIndexCall,
> = _r => {
  let array = %raw("_r.smocked.userNextPrice_stakedSyntheticTokenShiftIndex.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockWithdrawToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.withdraw.will.return()")
}

type withdrawCall = {
  token: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let withdrawCalls: t => array<withdrawCall> = _r => {
  let array = %raw("_r.smocked.withdraw.calls")
  array->Array.map(((token, amount)) => {
    {
      token: token,
      amount: amount,
    }
  })
}

let mockWithdrawAllToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.withdrawAll.will.return()")
}

type withdrawAllCall = {token: Ethers.ethAddress}

let withdrawAllCalls: t => array<withdrawAllCall> = _r => {
  let array = %raw("_r.smocked.withdrawAll.calls")
  array->Array.map(_m => {
    let token = _m->Array.getUnsafe(0)

    {
      token: token,
    }
  })
}

module InternalMock = {
  let mockContractName = "StakerForInternalMocking"
  type t = {address: Ethers.ethAddress}

  let internalRef: ref<option<t>> = ref(None)

  let functionToNotMock: ref<string> = ref("")

  @module("@eth-optimism/smock") external smock: 'a => Js.Promise.t<t> = "smockit"

  let setup: Staker.t => JsPromise.t<ContractHelpers.transaction> = contract => {
    ContractHelpers.deployContract0(mockContractName)
    ->JsPromise.then(a => {
      smock(a)
    })
    ->JsPromise.then(b => {
      internalRef := Some(b)
      contract->Staker.Exposed.setMocker(~mocker=(b->Obj.magic).address)
    })
  }

  let setFunctionForUnitTesting = (contract, ~functionName) => {
    functionToNotMock := functionName
    contract->Staker.Exposed.setFunctionToNotMock(~functionToNotMock=functionName)
  }

  let setupFunctionForUnitTesting = (contract, ~functionName) => {
    ContractHelpers.deployContract0(mockContractName)
    ->JsPromise.then(a => {
      smock(a)
    })
    ->JsPromise.then(b => {
      internalRef := Some(b)
      [
        contract->Staker.Exposed.setMocker(~mocker=(b->Obj.magic).address),
        contract->Staker.Exposed.setFunctionToNotMock(~functionToNotMock=functionName),
      ]->JsPromise.all
    })
  }

  exception MockingAFunctionThatYouShouldntBe

  exception HaventSetupInternalMockingForStaker

  let checkForExceptions = (~functionName) => {
    if functionToNotMock.contents == functionName {
      raise(MockingAFunctionThatYouShouldntBe)
    }
    if internalRef.contents == None {
      raise(HaventSetupInternalMockingForStaker)
    }
  }

  let mockOnlyAdminModifierLogicToReturn: unit => unit = () => {
    checkForExceptions(~functionName="onlyAdminModifierLogic")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.onlyAdminModifierLogicMock.will.return()")
    })
  }

  type onlyAdminModifierLogicCall

  let onlyAdminModifierLogicCalls: unit => array<onlyAdminModifierLogicCall> = () => {
    checkForExceptions(~functionName="onlyAdminModifierLogic")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.onlyAdminModifierLogicMock.calls")
      array->Array.map(() => {
        ()->Obj.magic
      })
    })
    ->Option.getExn
  }

  let mockOnlyValidSyntheticModifierLogicToReturn: unit => unit = () => {
    checkForExceptions(~functionName="onlyValidSyntheticModifierLogic")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.onlyValidSyntheticModifierLogicMock.will.return()")
    })
  }

  type onlyValidSyntheticModifierLogicCall = {synth: Ethers.ethAddress}

  let onlyValidSyntheticModifierLogicCalls: unit => array<
    onlyValidSyntheticModifierLogicCall,
  > = () => {
    checkForExceptions(~functionName="onlyValidSyntheticModifierLogic")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.onlyValidSyntheticModifierLogicMock.calls")
      array->Array.map(_m => {
        let synth = _m->Array.getUnsafe(0)

        {
          synth: synth,
        }
      })
    })
    ->Option.getExn
  }

  let mockOnlyValidMarketModifierLogicToReturn: unit => unit = () => {
    checkForExceptions(~functionName="onlyValidMarketModifierLogic")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.onlyValidMarketModifierLogicMock.will.return()")
    })
  }

  type onlyValidMarketModifierLogicCall = {marketIndex: int}

  let onlyValidMarketModifierLogicCalls: unit => array<onlyValidMarketModifierLogicCall> = () => {
    checkForExceptions(~functionName="onlyValidMarketModifierLogic")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.onlyValidMarketModifierLogicMock.calls")
      array->Array.map(_m => {
        let marketIndex = _m->Array.getUnsafe(0)

        {
          marketIndex: marketIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mockOnlyLongShortModifierLogicToReturn: unit => unit = () => {
    checkForExceptions(~functionName="onlyLongShortModifierLogic")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.onlyLongShortModifierLogicMock.will.return()")
    })
  }

  type onlyLongShortModifierLogicCall

  let onlyLongShortModifierLogicCalls: unit => array<onlyLongShortModifierLogicCall> = () => {
    checkForExceptions(~functionName="onlyLongShortModifierLogic")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.onlyLongShortModifierLogicMock.calls")
      array->Array.map(() => {
        ()->Obj.magic
      })
    })
    ->Option.getExn
  }

  let mockInitializeToReturn: unit => unit = () => {
    checkForExceptions(~functionName="initialize")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.initializeMock.will.return()")
    })
  }

  type initializeCall = {
    admin: Ethers.ethAddress,
    longShort: Ethers.ethAddress,
    floatToken: Ethers.ethAddress,
    floatTreasury: Ethers.ethAddress,
    floatCapital: Ethers.ethAddress,
    floatPercentage: Ethers.BigNumber.t,
  }

  let initializeCalls: unit => array<initializeCall> = () => {
    checkForExceptions(~functionName="initialize")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.initializeMock.calls")
      array->Array.map(((
        admin,
        longShort,
        floatToken,
        floatTreasury,
        floatCapital,
        floatPercentage,
      )) => {
        {
          admin: admin,
          longShort: longShort,
          floatToken: floatToken,
          floatTreasury: floatTreasury,
          floatCapital: floatCapital,
          floatPercentage: floatPercentage,
        }
      })
    })
    ->Option.getExn
  }

  let mock_changeFloatPercentageToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_changeFloatPercentage")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._changeFloatPercentageMock.will.return()")
    })
  }

  type _changeFloatPercentageCall = {newFloatPercentage: Ethers.BigNumber.t}

  let _changeFloatPercentageCalls: unit => array<_changeFloatPercentageCall> = () => {
    checkForExceptions(~functionName="_changeFloatPercentage")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._changeFloatPercentageMock.calls")
      array->Array.map(_m => {
        let newFloatPercentage = _m->Array.getUnsafe(0)

        {
          newFloatPercentage: newFloatPercentage,
        }
      })
    })
    ->Option.getExn
  }

  let mock_changeUnstakeFeeToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_changeUnstakeFee")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._changeUnstakeFeeMock.will.return()")
    })
  }

  type _changeUnstakeFeeCall = {
    marketIndex: int,
    newMarketUnstakeFee_e18: Ethers.BigNumber.t,
  }

  let _changeUnstakeFeeCalls: unit => array<_changeUnstakeFeeCall> = () => {
    checkForExceptions(~functionName="_changeUnstakeFee")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._changeUnstakeFeeMock.calls")
      array->Array.map(((marketIndex, newMarketUnstakeFee_e18)) => {
        {
          marketIndex: marketIndex,
          newMarketUnstakeFee_e18: newMarketUnstakeFee_e18,
        }
      })
    })
    ->Option.getExn
  }

  let mock_changeMarketLaunchIncentiveParametersToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_changeMarketLaunchIncentiveParameters")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._changeMarketLaunchIncentiveParametersMock.will.return()")
    })
  }

  type _changeMarketLaunchIncentiveParametersCall = {
    marketIndex: int,
    period: Ethers.BigNumber.t,
    initialMultiplier: Ethers.BigNumber.t,
  }

  let _changeMarketLaunchIncentiveParametersCalls: unit => array<
    _changeMarketLaunchIncentiveParametersCall,
  > = () => {
    checkForExceptions(~functionName="_changeMarketLaunchIncentiveParameters")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._changeMarketLaunchIncentiveParametersMock.calls")
      array->Array.map(((marketIndex, period, initialMultiplier)) => {
        {
          marketIndex: marketIndex,
          period: period,
          initialMultiplier: initialMultiplier,
        }
      })
    })
    ->Option.getExn
  }

  let mock_changeBalanceIncentiveExponentToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_changeBalanceIncentiveExponent")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._changeBalanceIncentiveExponentMock.will.return()")
    })
  }

  type _changeBalanceIncentiveExponentCall = {
    marketIndex: int,
    balanceIncentiveCurve_exponent: Ethers.BigNumber.t,
  }

  let _changeBalanceIncentiveExponentCalls: unit => array<
    _changeBalanceIncentiveExponentCall,
  > = () => {
    checkForExceptions(~functionName="_changeBalanceIncentiveExponent")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._changeBalanceIncentiveExponentMock.calls")
      array->Array.map(((marketIndex, balanceIncentiveCurve_exponent)) => {
        {
          marketIndex: marketIndex,
          balanceIncentiveCurve_exponent: balanceIncentiveCurve_exponent,
        }
      })
    })
    ->Option.getExn
  }

  let mock_changeBalanceIncentiveEquilibriumOffsetToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_changeBalanceIncentiveEquilibriumOffset")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._changeBalanceIncentiveEquilibriumOffsetMock.will.return()")
    })
  }

  type _changeBalanceIncentiveEquilibriumOffsetCall = {
    marketIndex: int,
    balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  }

  let _changeBalanceIncentiveEquilibriumOffsetCalls: unit => array<
    _changeBalanceIncentiveEquilibriumOffsetCall,
  > = () => {
    checkForExceptions(~functionName="_changeBalanceIncentiveEquilibriumOffset")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._changeBalanceIncentiveEquilibriumOffsetMock.calls")
      array->Array.map(((marketIndex, balanceIncentiveCurve_equilibriumOffset)) => {
        {
          marketIndex: marketIndex,
          balanceIncentiveCurve_equilibriumOffset: balanceIncentiveCurve_equilibriumOffset,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getMarketLaunchIncentiveParametersToReturn: (
    Ethers.BigNumber.t,
    Ethers.BigNumber.t,
  ) => unit = (_param0, _param1) => {
    checkForExceptions(~functionName="_getMarketLaunchIncentiveParameters")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._getMarketLaunchIncentiveParametersMock.will.return.with([_param0,_param1])"
      )
    })
  }

  type _getMarketLaunchIncentiveParametersCall = {marketIndex: int}

  let _getMarketLaunchIncentiveParametersCalls: unit => array<
    _getMarketLaunchIncentiveParametersCall,
  > = () => {
    checkForExceptions(~functionName="_getMarketLaunchIncentiveParameters")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getMarketLaunchIncentiveParametersMock.calls")
      array->Array.map(_m => {
        let marketIndex = _m->Array.getUnsafe(0)

        {
          marketIndex: marketIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getKValueToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_getKValue")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._getKValueMock.will.return.with([_param0])")
    })
  }

  type _getKValueCall = {marketIndex: int}

  let _getKValueCalls: unit => array<_getKValueCall> = () => {
    checkForExceptions(~functionName="_getKValue")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getKValueMock.calls")
      array->Array.map(_m => {
        let marketIndex = _m->Array.getUnsafe(0)

        {
          marketIndex: marketIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mock_calculateFloatPerSecondToReturn: (Ethers.BigNumber.t, Ethers.BigNumber.t) => unit = (
    _param0,
    _param1,
  ) => {
    checkForExceptions(~functionName="_calculateFloatPerSecond")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._calculateFloatPerSecondMock.will.return.with([_param0,_param1])")
    })
  }

  type _calculateFloatPerSecondCall = {
    marketIndex: int,
    longPrice: Ethers.BigNumber.t,
    shortPrice: Ethers.BigNumber.t,
    longValue: Ethers.BigNumber.t,
    shortValue: Ethers.BigNumber.t,
  }

  let _calculateFloatPerSecondCalls: unit => array<_calculateFloatPerSecondCall> = () => {
    checkForExceptions(~functionName="_calculateFloatPerSecond")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._calculateFloatPerSecondMock.calls")
      array->Array.map(((marketIndex, longPrice, shortPrice, longValue, shortValue)) => {
        {
          marketIndex: marketIndex,
          longPrice: longPrice,
          shortPrice: shortPrice,
          longValue: longValue,
          shortValue: shortValue,
        }
      })
    })
    ->Option.getExn
  }

  let mock_calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(
      ~functionName="_calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshot",
    )
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotMock.will.return.with([_param0])"
      )
    })
  }

  type _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotCall = {
    marketIndex: int,
  }

  let _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotCalls: unit => array<
    _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotCall,
  > = () => {
    checkForExceptions(
      ~functionName="_calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshot",
    )
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw(
        "_r.smocked._calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotMock.calls"
      )
      array->Array.map(_m => {
        let marketIndex = _m->Array.getUnsafe(0)

        {
          marketIndex: marketIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mock_calculateNewCumulativeIssuancePerStakedSynthToReturn: (
    Ethers.BigNumber.t,
    Ethers.BigNumber.t,
  ) => unit = (_param0, _param1) => {
    checkForExceptions(~functionName="_calculateNewCumulativeIssuancePerStakedSynth")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._calculateNewCumulativeIssuancePerStakedSynthMock.will.return.with([_param0,_param1])"
      )
    })
  }

  type _calculateNewCumulativeIssuancePerStakedSynthCall = {
    marketIndex: int,
    longPrice: Ethers.BigNumber.t,
    shortPrice: Ethers.BigNumber.t,
    longValue: Ethers.BigNumber.t,
    shortValue: Ethers.BigNumber.t,
  }

  let _calculateNewCumulativeIssuancePerStakedSynthCalls: unit => array<
    _calculateNewCumulativeIssuancePerStakedSynthCall,
  > = () => {
    checkForExceptions(~functionName="_calculateNewCumulativeIssuancePerStakedSynth")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._calculateNewCumulativeIssuancePerStakedSynthMock.calls")
      array->Array.map(((marketIndex, longPrice, shortPrice, longValue, shortValue)) => {
        {
          marketIndex: marketIndex,
          longPrice: longPrice,
          shortPrice: shortPrice,
          longValue: longValue,
          shortValue: shortValue,
        }
      })
    })
    ->Option.getExn
  }

  let mock_setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotMock.will.return()"
      )
    })
  }

  type _setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotCall = {
    marketIndex: int,
    longPrice: Ethers.BigNumber.t,
    shortPrice: Ethers.BigNumber.t,
    longValue: Ethers.BigNumber.t,
    shortValue: Ethers.BigNumber.t,
  }

  let _setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotCalls: unit => array<
    _setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotCall,
  > = () => {
    checkForExceptions(~functionName="_setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw(
        "_r.smocked._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotMock.calls"
      )
      array->Array.map(((marketIndex, longPrice, shortPrice, longValue, shortValue)) => {
        {
          marketIndex: marketIndex,
          longPrice: longPrice,
          shortPrice: shortPrice,
          longValue: longValue,
          shortValue: shortValue,
        }
      })
    })
    ->Option.getExn
  }

  let mock_calculateAccumulatedFloatInRangeToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_calculateAccumulatedFloatInRange")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._calculateAccumulatedFloatInRangeMock.will.return.with([_param0])")
    })
  }

  type _calculateAccumulatedFloatInRangeCall = {
    marketIndex: int,
    amountStakedLong: Ethers.BigNumber.t,
    amountStakedShort: Ethers.BigNumber.t,
    rewardIndexFrom: Ethers.BigNumber.t,
    rewardIndexTo: Ethers.BigNumber.t,
  }

  let _calculateAccumulatedFloatInRangeCalls: unit => array<
    _calculateAccumulatedFloatInRangeCall,
  > = () => {
    checkForExceptions(~functionName="_calculateAccumulatedFloatInRange")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._calculateAccumulatedFloatInRangeMock.calls")
      array->Array.map(((
        marketIndex,
        amountStakedLong,
        amountStakedShort,
        rewardIndexFrom,
        rewardIndexTo,
      )) => {
        {
          marketIndex: marketIndex,
          amountStakedLong: amountStakedLong,
          amountStakedShort: amountStakedShort,
          rewardIndexFrom: rewardIndexFrom,
          rewardIndexTo: rewardIndexTo,
        }
      })
    })
    ->Option.getExn
  }

  let mock_calculateAccumulatedFloatToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_calculateAccumulatedFloat")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._calculateAccumulatedFloatMock.will.return.with([_param0])")
    })
  }

  type _calculateAccumulatedFloatCall = {
    marketIndex: int,
    user: Ethers.ethAddress,
  }

  let _calculateAccumulatedFloatCalls: unit => array<_calculateAccumulatedFloatCall> = () => {
    checkForExceptions(~functionName="_calculateAccumulatedFloat")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._calculateAccumulatedFloatMock.calls")
      array->Array.map(((marketIndex, user)) => {
        {
          marketIndex: marketIndex,
          user: user,
        }
      })
    })
    ->Option.getExn
  }

  let mock_mintFloatToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_mintFloat")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._mintFloatMock.will.return()")
    })
  }

  type _mintFloatCall = {
    user: Ethers.ethAddress,
    floatToMint: Ethers.BigNumber.t,
  }

  let _mintFloatCalls: unit => array<_mintFloatCall> = () => {
    checkForExceptions(~functionName="_mintFloat")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._mintFloatMock.calls")
      array->Array.map(((user, floatToMint)) => {
        {
          user: user,
          floatToMint: floatToMint,
        }
      })
    })
    ->Option.getExn
  }

  let mock_mintAccumulatedFloatToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_mintAccumulatedFloat")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._mintAccumulatedFloatMock.will.return()")
    })
  }

  type _mintAccumulatedFloatCall = {
    marketIndex: int,
    user: Ethers.ethAddress,
  }

  let _mintAccumulatedFloatCalls: unit => array<_mintAccumulatedFloatCall> = () => {
    checkForExceptions(~functionName="_mintAccumulatedFloat")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._mintAccumulatedFloatMock.calls")
      array->Array.map(((marketIndex, user)) => {
        {
          marketIndex: marketIndex,
          user: user,
        }
      })
    })
    ->Option.getExn
  }

  let mock_mintAccumulatedFloatMultiToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_mintAccumulatedFloatMulti")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._mintAccumulatedFloatMultiMock.will.return()")
    })
  }

  type _mintAccumulatedFloatMultiCall = {
    marketIndexes: array<int>,
    user: Ethers.ethAddress,
  }

  let _mintAccumulatedFloatMultiCalls: unit => array<_mintAccumulatedFloatMultiCall> = () => {
    checkForExceptions(~functionName="_mintAccumulatedFloatMulti")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._mintAccumulatedFloatMultiMock.calls")
      array->Array.map(((marketIndexes, user)) => {
        {
          marketIndexes: marketIndexes,
          user: user,
        }
      })
    })
    ->Option.getExn
  }

  let mockStakeFromUserToReturn: unit => unit = () => {
    checkForExceptions(~functionName="stakeFromUser")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.stakeFromUserMock.will.return()")
    })
  }

  type stakeFromUserCall = {
    from: Ethers.ethAddress,
    amount: Ethers.BigNumber.t,
  }

  let stakeFromUserCalls: unit => array<stakeFromUserCall> = () => {
    checkForExceptions(~functionName="stakeFromUser")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.stakeFromUserMock.calls")
      array->Array.map(((from, amount)) => {
        {
          from: from,
          amount: amount,
        }
      })
    })
    ->Option.getExn
  }

  let mock_stakeToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_stake")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._stakeMock.will.return()")
    })
  }

  type _stakeCall = {
    token: Ethers.ethAddress,
    amount: Ethers.BigNumber.t,
    user: Ethers.ethAddress,
  }

  let _stakeCalls: unit => array<_stakeCall> = () => {
    checkForExceptions(~functionName="_stake")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._stakeMock.calls")
      array->Array.map(((token, amount, user)) => {
        {
          token: token,
          amount: amount,
          user: user,
        }
      })
    })
    ->Option.getExn
  }

  let mockShiftTokensToReturn: unit => unit = () => {
    checkForExceptions(~functionName="shiftTokens")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.shiftTokensMock.will.return()")
    })
  }

  type shiftTokensCall = {
    amountSyntheticTokensToShift: Ethers.BigNumber.t,
    marketIndex: int,
    isShiftFromLong: bool,
  }

  let shiftTokensCalls: unit => array<shiftTokensCall> = () => {
    checkForExceptions(~functionName="shiftTokens")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.shiftTokensMock.calls")
      array->Array.map(((amountSyntheticTokensToShift, marketIndex, isShiftFromLong)) => {
        {
          amountSyntheticTokensToShift: amountSyntheticTokensToShift,
          marketIndex: marketIndex,
          isShiftFromLong: isShiftFromLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_withdrawToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_withdraw")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._withdrawMock.will.return()")
    })
  }

  type _withdrawCall = {
    marketIndex: int,
    token: Ethers.ethAddress,
    amount: Ethers.BigNumber.t,
  }

  let _withdrawCalls: unit => array<_withdrawCall> = () => {
    checkForExceptions(~functionName="_withdraw")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._withdrawMock.calls")
      array->Array.map(((marketIndex, token, amount)) => {
        {
          marketIndex: marketIndex,
          token: token,
          amount: amount,
        }
      })
    })
    ->Option.getExn
  }
}

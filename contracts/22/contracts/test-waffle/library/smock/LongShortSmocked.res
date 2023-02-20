type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: LongShort.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockPERMANENT_INITIAL_LIQUIDITY_HOLDERToReturn: (t, Ethers.ethAddress) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.PERMANENT_INITIAL_LIQUIDITY_HOLDER.will.return.with([_param0])")
}

type pERMANENT_INITIAL_LIQUIDITY_HOLDERCall

let pERMANENT_INITIAL_LIQUIDITY_HOLDERCalls: t => array<
  pERMANENT_INITIAL_LIQUIDITY_HOLDERCall,
> = _r => {
  let array = %raw("_r.smocked.PERMANENT_INITIAL_LIQUIDITY_HOLDER.calls")
  array->Array.map(() => {
    ()->Obj.magic
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

let mockAssetPriceToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.assetPrice.will.return.with([_param0])")
}

type assetPriceCall = {param0: int}

let assetPriceCalls: t => array<assetPriceCall> = _r => {
  let array = %raw("_r.smocked.assetPrice.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockBatched_amountPaymentToken_depositToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.batched_amountPaymentToken_deposit.will.return.with([_param0])")
}

type batched_amountPaymentToken_depositCall = {
  param0: int,
  param1: bool,
}

let batched_amountPaymentToken_depositCalls: t => array<
  batched_amountPaymentToken_depositCall,
> = _r => {
  let array = %raw("_r.smocked.batched_amountPaymentToken_deposit.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockBatched_amountSyntheticToken_redeemToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.batched_amountSyntheticToken_redeem.will.return.with([_param0])")
}

type batched_amountSyntheticToken_redeemCall = {
  param0: int,
  param1: bool,
}

let batched_amountSyntheticToken_redeemCalls: t => array<
  batched_amountSyntheticToken_redeemCall,
> = _r => {
  let array = %raw("_r.smocked.batched_amountSyntheticToken_redeem.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockBatched_amountSyntheticToken_toShiftAwayFrom_marketSideToReturn: (
  t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0) => {
  let _ = %raw(
    "_r.smocked.batched_amountSyntheticToken_toShiftAwayFrom_marketSide.will.return.with([_param0])"
  )
}

type batched_amountSyntheticToken_toShiftAwayFrom_marketSideCall = {
  param0: int,
  param1: bool,
}

let batched_amountSyntheticToken_toShiftAwayFrom_marketSideCalls: t => array<
  batched_amountSyntheticToken_toShiftAwayFrom_marketSideCall,
> = _r => {
  let array = %raw("_r.smocked.batched_amountSyntheticToken_toShiftAwayFrom_marketSide.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
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

let mockChangeMarketTreasurySplitGradientToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeMarketTreasurySplitGradient.will.return()")
}

type changeMarketTreasurySplitGradientCall = {
  marketIndex: int,
  marketTreasurySplitGradient_e18: Ethers.BigNumber.t,
}

let changeMarketTreasurySplitGradientCalls: t => array<
  changeMarketTreasurySplitGradientCall,
> = _r => {
  let array = %raw("_r.smocked.changeMarketTreasurySplitGradient.calls")
  array->Array.map(((marketIndex, marketTreasurySplitGradient_e18)) => {
    {
      marketIndex: marketIndex,
      marketTreasurySplitGradient_e18: marketTreasurySplitGradient_e18,
    }
  })
}

let mockChangeTreasuryToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.changeTreasury.will.return()")
}

type changeTreasuryCall = {treasury: Ethers.ethAddress}

let changeTreasuryCalls: t => array<changeTreasuryCall> = _r => {
  let array = %raw("_r.smocked.changeTreasury.calls")
  array->Array.map(_m => {
    let treasury = _m->Array.getUnsafe(0)

    {
      treasury: treasury,
    }
  })
}

let mockCreateNewSyntheticMarketToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.createNewSyntheticMarket.will.return()")
}

type createNewSyntheticMarketCall = {
  syntheticName: string,
  syntheticSymbol: string,
  paymentToken: Ethers.ethAddress,
  oracleManager: Ethers.ethAddress,
  yieldManager: Ethers.ethAddress,
}

let createNewSyntheticMarketCalls: t => array<createNewSyntheticMarketCall> = _r => {
  let array = %raw("_r.smocked.createNewSyntheticMarket.calls")
  array->Array.map(((
    syntheticName,
    syntheticSymbol,
    paymentToken,
    oracleManager,
    yieldManager,
  )) => {
    {
      syntheticName: syntheticName,
      syntheticSymbol: syntheticSymbol,
      paymentToken: paymentToken,
      oracleManager: oracleManager,
      yieldManager: yieldManager,
    }
  })
}

let mockExecuteOutstandingNextPriceSettlementsUserToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.executeOutstandingNextPriceSettlementsUser.will.return()")
}

type executeOutstandingNextPriceSettlementsUserCall = {
  user: Ethers.ethAddress,
  marketIndex: int,
}

let executeOutstandingNextPriceSettlementsUserCalls: t => array<
  executeOutstandingNextPriceSettlementsUserCall,
> = _r => {
  let array = %raw("_r.smocked.executeOutstandingNextPriceSettlementsUser.calls")
  array->Array.map(((user, marketIndex)) => {
    {
      user: user,
      marketIndex: marketIndex,
    }
  })
}

let mockExecuteOutstandingNextPriceSettlementsUserMultiToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.executeOutstandingNextPriceSettlementsUserMulti.will.return()")
}

type executeOutstandingNextPriceSettlementsUserMultiCall = {
  user: Ethers.ethAddress,
  marketIndexes: array<int>,
}

let executeOutstandingNextPriceSettlementsUserMultiCalls: t => array<
  executeOutstandingNextPriceSettlementsUserMultiCall,
> = _r => {
  let array = %raw("_r.smocked.executeOutstandingNextPriceSettlementsUserMulti.calls")
  array->Array.map(((user, marketIndexes)) => {
    {
      user: user,
      marketIndexes: marketIndexes,
    }
  })
}

let mockGetAmountSyntheticTokenToMintOnTargetSideToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.getAmountSyntheticTokenToMintOnTargetSide.will.return.with([_param0])")
}

type getAmountSyntheticTokenToMintOnTargetSideCall = {
  marketIndex: int,
  amountSyntheticToken_redeemOnOriginSide: Ethers.BigNumber.t,
  isShiftFromLong: bool,
  priceSnapshotIndex: Ethers.BigNumber.t,
}

let getAmountSyntheticTokenToMintOnTargetSideCalls: t => array<
  getAmountSyntheticTokenToMintOnTargetSideCall,
> = _r => {
  let array = %raw("_r.smocked.getAmountSyntheticTokenToMintOnTargetSide.calls")
  array->Array.map(((
    marketIndex,
    amountSyntheticToken_redeemOnOriginSide,
    isShiftFromLong,
    priceSnapshotIndex,
  )) => {
    {
      marketIndex: marketIndex,
      amountSyntheticToken_redeemOnOriginSide: amountSyntheticToken_redeemOnOriginSide,
      isShiftFromLong: isShiftFromLong,
      priceSnapshotIndex: priceSnapshotIndex,
    }
  })
}

let mockGetUsersConfirmedButNotSettledSynthBalanceToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.getUsersConfirmedButNotSettledSynthBalance.will.return.with([_param0])")
}

type getUsersConfirmedButNotSettledSynthBalanceCall = {
  user: Ethers.ethAddress,
  marketIndex: int,
  isLong: bool,
}

let getUsersConfirmedButNotSettledSynthBalanceCalls: t => array<
  getUsersConfirmedButNotSettledSynthBalanceCall,
> = _r => {
  let array = %raw("_r.smocked.getUsersConfirmedButNotSettledSynthBalance.calls")
  array->Array.map(((user, marketIndex, isLong)) => {
    {
      user: user,
      marketIndex: marketIndex,
      isLong: isLong,
    }
  })
}

let mockInitializeToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.initialize.will.return()")
}

type initializeCall = {
  admin: Ethers.ethAddress,
  treasury: Ethers.ethAddress,
  tokenFactory: Ethers.ethAddress,
  staker: Ethers.ethAddress,
}

let initializeCalls: t => array<initializeCall> = _r => {
  let array = %raw("_r.smocked.initialize.calls")
  array->Array.map(((admin, treasury, tokenFactory, staker)) => {
    {
      admin: admin,
      treasury: treasury,
      tokenFactory: tokenFactory,
      staker: staker,
    }
  })
}

let mockInitializeMarketToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.initializeMarket.will.return()")
}

type initializeMarketCall = {
  marketIndex: int,
  kInitialMultiplier: Ethers.BigNumber.t,
  kPeriod: Ethers.BigNumber.t,
  unstakeFee_e18: Ethers.BigNumber.t,
  initialMarketSeedForEachMarketSide: Ethers.BigNumber.t,
  balanceIncentiveCurve_exponent: Ethers.BigNumber.t,
  balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  marketTreasurySplitGradient_e18: Ethers.BigNumber.t,
}

let initializeMarketCalls: t => array<initializeMarketCall> = _r => {
  let array = %raw("_r.smocked.initializeMarket.calls")
  array->Array.map(((
    marketIndex,
    kInitialMultiplier,
    kPeriod,
    unstakeFee_e18,
    initialMarketSeedForEachMarketSide,
    balanceIncentiveCurve_exponent,
    balanceIncentiveCurve_equilibriumOffset,
    marketTreasurySplitGradient_e18,
  )) => {
    {
      marketIndex: marketIndex,
      kInitialMultiplier: kInitialMultiplier,
      kPeriod: kPeriod,
      unstakeFee_e18: unstakeFee_e18,
      initialMarketSeedForEachMarketSide: initialMarketSeedForEachMarketSide,
      balanceIncentiveCurve_exponent: balanceIncentiveCurve_exponent,
      balanceIncentiveCurve_equilibriumOffset: balanceIncentiveCurve_equilibriumOffset,
      marketTreasurySplitGradient_e18: marketTreasurySplitGradient_e18,
    }
  })
}

let mockLatestMarketToReturn: (t, int) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.latestMarket.will.return.with([_param0])")
}

type latestMarketCall

let latestMarketCalls: t => array<latestMarketCall> = _r => {
  let array = %raw("_r.smocked.latestMarket.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockMarketExistsToReturn: (t, bool) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.marketExists.will.return.with([_param0])")
}

type marketExistsCall = {param0: int}

let marketExistsCalls: t => array<marketExistsCall> = _r => {
  let array = %raw("_r.smocked.marketExists.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockMarketSideValueInPaymentTokenToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.marketSideValueInPaymentToken.will.return.with([_param0])")
}

type marketSideValueInPaymentTokenCall = {
  param0: int,
  param1: bool,
}

let marketSideValueInPaymentTokenCalls: t => array<marketSideValueInPaymentTokenCall> = _r => {
  let array = %raw("_r.smocked.marketSideValueInPaymentToken.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockMarketTreasurySplitGradient_e18ToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.marketTreasurySplitGradient_e18.will.return.with([_param0])")
}

type marketTreasurySplitGradient_e18Call = {param0: int}

let marketTreasurySplitGradient_e18Calls: t => array<marketTreasurySplitGradient_e18Call> = _r => {
  let array = %raw("_r.smocked.marketTreasurySplitGradient_e18.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockMarketUpdateIndexToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.marketUpdateIndex.will.return.with([_param0])")
}

type marketUpdateIndexCall = {param0: int}

let marketUpdateIndexCalls: t => array<marketUpdateIndexCall> = _r => {
  let array = %raw("_r.smocked.marketUpdateIndex.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockMintLongNextPriceToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.mintLongNextPrice.will.return()")
}

type mintLongNextPriceCall = {
  marketIndex: int,
  amount: Ethers.BigNumber.t,
}

let mintLongNextPriceCalls: t => array<mintLongNextPriceCall> = _r => {
  let array = %raw("_r.smocked.mintLongNextPrice.calls")
  array->Array.map(((marketIndex, amount)) => {
    {
      marketIndex: marketIndex,
      amount: amount,
    }
  })
}

let mockMintShortNextPriceToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.mintShortNextPrice.will.return()")
}

type mintShortNextPriceCall = {
  marketIndex: int,
  amount: Ethers.BigNumber.t,
}

let mintShortNextPriceCalls: t => array<mintShortNextPriceCall> = _r => {
  let array = %raw("_r.smocked.mintShortNextPrice.calls")
  array->Array.map(((marketIndex, amount)) => {
    {
      marketIndex: marketIndex,
      amount: amount,
    }
  })
}

let mockOracleManagersToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.oracleManagers.will.return.with([_param0])")
}

type oracleManagersCall = {param0: int}

let oracleManagersCalls: t => array<oracleManagersCall> = _r => {
  let array = %raw("_r.smocked.oracleManagers.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockPaymentTokensToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.paymentTokens.will.return.with([_param0])")
}

type paymentTokensCall = {param0: int}

let paymentTokensCalls: t => array<paymentTokensCall> = _r => {
  let array = %raw("_r.smocked.paymentTokens.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

let mockRedeemLongNextPriceToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.redeemLongNextPrice.will.return()")
}

type redeemLongNextPriceCall = {
  marketIndex: int,
  tokens_redeem: Ethers.BigNumber.t,
}

let redeemLongNextPriceCalls: t => array<redeemLongNextPriceCall> = _r => {
  let array = %raw("_r.smocked.redeemLongNextPrice.calls")
  array->Array.map(((marketIndex, tokens_redeem)) => {
    {
      marketIndex: marketIndex,
      tokens_redeem: tokens_redeem,
    }
  })
}

let mockRedeemShortNextPriceToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.redeemShortNextPrice.will.return()")
}

type redeemShortNextPriceCall = {
  marketIndex: int,
  tokens_redeem: Ethers.BigNumber.t,
}

let redeemShortNextPriceCalls: t => array<redeemShortNextPriceCall> = _r => {
  let array = %raw("_r.smocked.redeemShortNextPrice.calls")
  array->Array.map(((marketIndex, tokens_redeem)) => {
    {
      marketIndex: marketIndex,
      tokens_redeem: tokens_redeem,
    }
  })
}

let mockShiftPositionFromLongNextPriceToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.shiftPositionFromLongNextPrice.will.return()")
}

type shiftPositionFromLongNextPriceCall = {
  marketIndex: int,
  amountSyntheticTokensToShift: Ethers.BigNumber.t,
}

let shiftPositionFromLongNextPriceCalls: t => array<shiftPositionFromLongNextPriceCall> = _r => {
  let array = %raw("_r.smocked.shiftPositionFromLongNextPrice.calls")
  array->Array.map(((marketIndex, amountSyntheticTokensToShift)) => {
    {
      marketIndex: marketIndex,
      amountSyntheticTokensToShift: amountSyntheticTokensToShift,
    }
  })
}

let mockShiftPositionFromShortNextPriceToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.shiftPositionFromShortNextPrice.will.return()")
}

type shiftPositionFromShortNextPriceCall = {
  marketIndex: int,
  amountSyntheticTokensToShift: Ethers.BigNumber.t,
}

let shiftPositionFromShortNextPriceCalls: t => array<shiftPositionFromShortNextPriceCall> = _r => {
  let array = %raw("_r.smocked.shiftPositionFromShortNextPrice.calls")
  array->Array.map(((marketIndex, amountSyntheticTokensToShift)) => {
    {
      marketIndex: marketIndex,
      amountSyntheticTokensToShift: amountSyntheticTokensToShift,
    }
  })
}

let mockStakerToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.staker.will.return.with([_param0])")
}

type stakerCall

let stakerCalls: t => array<stakerCall> = _r => {
  let array = %raw("_r.smocked.staker.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockSyntheticToken_priceSnapshotToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.syntheticToken_priceSnapshot.will.return.with([_param0])")
}

type syntheticToken_priceSnapshotCall = {
  param0: int,
  param1: bool,
  param2: Ethers.BigNumber.t,
}

let syntheticToken_priceSnapshotCalls: t => array<syntheticToken_priceSnapshotCall> = _r => {
  let array = %raw("_r.smocked.syntheticToken_priceSnapshot.calls")
  array->Array.map(((param0, param1, param2)) => {
    {
      param0: param0,
      param1: param1,
      param2: param2,
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

let mockTokenFactoryToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.tokenFactory.will.return.with([_param0])")
}

type tokenFactoryCall

let tokenFactoryCalls: t => array<tokenFactoryCall> = _r => {
  let array = %raw("_r.smocked.tokenFactory.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockTreasuryToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.treasury.will.return.with([_param0])")
}

type treasuryCall

let treasuryCalls: t => array<treasuryCall> = _r => {
  let array = %raw("_r.smocked.treasury.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockUpdateMarketOracleToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.updateMarketOracle.will.return()")
}

type updateMarketOracleCall = {
  marketIndex: int,
  newOracleManager: Ethers.ethAddress,
}

let updateMarketOracleCalls: t => array<updateMarketOracleCall> = _r => {
  let array = %raw("_r.smocked.updateMarketOracle.calls")
  array->Array.map(((marketIndex, newOracleManager)) => {
    {
      marketIndex: marketIndex,
      newOracleManager: newOracleManager,
    }
  })
}

let mockUpdateSystemStateToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.updateSystemState.will.return()")
}

type updateSystemStateCall = {marketIndex: int}

let updateSystemStateCalls: t => array<updateSystemStateCall> = _r => {
  let array = %raw("_r.smocked.updateSystemState.calls")
  array->Array.map(_m => {
    let marketIndex = _m->Array.getUnsafe(0)

    {
      marketIndex: marketIndex,
    }
  })
}

let mockUpdateSystemStateMultiToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.updateSystemStateMulti.will.return()")
}

type updateSystemStateMultiCall = {marketIndexes: array<int>}

let updateSystemStateMultiCalls: t => array<updateSystemStateMultiCall> = _r => {
  let array = %raw("_r.smocked.updateSystemStateMulti.calls")
  array->Array.map(_m => {
    let marketIndexes = _m->Array.getUnsafe(0)

    {
      marketIndexes: marketIndexes,
    }
  })
}

let mockUserNextPrice_currentUpdateIndexToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.userNextPrice_currentUpdateIndex.will.return.with([_param0])")
}

type userNextPrice_currentUpdateIndexCall = {
  param0: int,
  param1: Ethers.ethAddress,
}

let userNextPrice_currentUpdateIndexCalls: t => array<
  userNextPrice_currentUpdateIndexCall,
> = _r => {
  let array = %raw("_r.smocked.userNextPrice_currentUpdateIndex.calls")
  array->Array.map(((param0, param1)) => {
    {
      param0: param0,
      param1: param1,
    }
  })
}

let mockUserNextPrice_paymentToken_depositAmountToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.userNextPrice_paymentToken_depositAmount.will.return.with([_param0])")
}

type userNextPrice_paymentToken_depositAmountCall = {
  param0: int,
  param1: bool,
  param2: Ethers.ethAddress,
}

let userNextPrice_paymentToken_depositAmountCalls: t => array<
  userNextPrice_paymentToken_depositAmountCall,
> = _r => {
  let array = %raw("_r.smocked.userNextPrice_paymentToken_depositAmount.calls")
  array->Array.map(((param0, param1, param2)) => {
    {
      param0: param0,
      param1: param1,
      param2: param2,
    }
  })
}

let mockUserNextPrice_syntheticToken_redeemAmountToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw("_r.smocked.userNextPrice_syntheticToken_redeemAmount.will.return.with([_param0])")
}

type userNextPrice_syntheticToken_redeemAmountCall = {
  param0: int,
  param1: bool,
  param2: Ethers.ethAddress,
}

let userNextPrice_syntheticToken_redeemAmountCalls: t => array<
  userNextPrice_syntheticToken_redeemAmountCall,
> = _r => {
  let array = %raw("_r.smocked.userNextPrice_syntheticToken_redeemAmount.calls")
  array->Array.map(((param0, param1, param2)) => {
    {
      param0: param0,
      param1: param1,
      param2: param2,
    }
  })
}

let mockUserNextPrice_syntheticToken_toShiftAwayFrom_marketSideToReturn: (
  t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0) => {
  let _ = %raw(
    "_r.smocked.userNextPrice_syntheticToken_toShiftAwayFrom_marketSide.will.return.with([_param0])"
  )
}

type userNextPrice_syntheticToken_toShiftAwayFrom_marketSideCall = {
  param0: int,
  param1: bool,
  param2: Ethers.ethAddress,
}

let userNextPrice_syntheticToken_toShiftAwayFrom_marketSideCalls: t => array<
  userNextPrice_syntheticToken_toShiftAwayFrom_marketSideCall,
> = _r => {
  let array = %raw("_r.smocked.userNextPrice_syntheticToken_toShiftAwayFrom_marketSide.calls")
  array->Array.map(((param0, param1, param2)) => {
    {
      param0: param0,
      param1: param1,
      param2: param2,
    }
  })
}

let mockYieldManagersToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.yieldManagers.will.return.with([_param0])")
}

type yieldManagersCall = {param0: int}

let yieldManagersCalls: t => array<yieldManagersCall> = _r => {
  let array = %raw("_r.smocked.yieldManagers.calls")
  array->Array.map(_m => {
    let param0 = _m->Array.getUnsafe(0)

    {
      param0: param0,
    }
  })
}

module InternalMock = {
  let mockContractName = "LongShortForInternalMocking"
  type t = {address: Ethers.ethAddress}

  let internalRef: ref<option<t>> = ref(None)

  let functionToNotMock: ref<string> = ref("")

  @module("@eth-optimism/smock") external smock: 'a => Js.Promise.t<t> = "smockit"

  let setup: LongShort.t => JsPromise.t<ContractHelpers.transaction> = contract => {
    ContractHelpers.deployContract0(mockContractName)
    ->JsPromise.then(a => {
      smock(a)
    })
    ->JsPromise.then(b => {
      internalRef := Some(b)
      contract->LongShort.Exposed.setMocker(~mocker=(b->Obj.magic).address)
    })
  }

  let setFunctionForUnitTesting = (contract, ~functionName) => {
    functionToNotMock := functionName
    contract->LongShort.Exposed.setFunctionToNotMock(~functionToNotMock=functionName)
  }

  let setupFunctionForUnitTesting = (contract, ~functionName) => {
    ContractHelpers.deployContract0(mockContractName)
    ->JsPromise.then(a => {
      smock(a)
    })
    ->JsPromise.then(b => {
      internalRef := Some(b)
      [
        contract->LongShort.Exposed.setMocker(~mocker=(b->Obj.magic).address),
        contract->LongShort.Exposed.setFunctionToNotMock(~functionToNotMock=functionName),
      ]->JsPromise.all
    })
  }

  exception MockingAFunctionThatYouShouldntBe

  exception HaventSetupInternalMockingForLongShort

  let checkForExceptions = (~functionName) => {
    if functionToNotMock.contents == functionName {
      raise(MockingAFunctionThatYouShouldntBe)
    }
    if internalRef.contents == None {
      raise(HaventSetupInternalMockingForLongShort)
    }
  }

  let mockAdminOnlyModifierLogicToReturn: unit => unit = () => {
    checkForExceptions(~functionName="adminOnlyModifierLogic")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.adminOnlyModifierLogicMock.will.return()")
    })
  }

  type adminOnlyModifierLogicCall

  let adminOnlyModifierLogicCalls: unit => array<adminOnlyModifierLogicCall> = () => {
    checkForExceptions(~functionName="adminOnlyModifierLogic")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.adminOnlyModifierLogicMock.calls")
      array->Array.map(() => {
        ()->Obj.magic
      })
    })
    ->Option.getExn
  }

  let mockRequireMarketExistsModifierLogicToReturn: unit => unit = () => {
    checkForExceptions(~functionName="requireMarketExistsModifierLogic")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked.requireMarketExistsModifierLogicMock.will.return()")
    })
  }

  type requireMarketExistsModifierLogicCall = {marketIndex: int}

  let requireMarketExistsModifierLogicCalls: unit => array<
    requireMarketExistsModifierLogicCall,
  > = () => {
    checkForExceptions(~functionName="requireMarketExistsModifierLogic")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.requireMarketExistsModifierLogicMock.calls")
      array->Array.map(_m => {
        let marketIndex = _m->Array.getUnsafe(0)

        {
          marketIndex: marketIndex,
        }
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
    treasury: Ethers.ethAddress,
    tokenFactory: Ethers.ethAddress,
    staker: Ethers.ethAddress,
  }

  let initializeCalls: unit => array<initializeCall> = () => {
    checkForExceptions(~functionName="initialize")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.initializeMock.calls")
      array->Array.map(((admin, treasury, tokenFactory, staker)) => {
        {
          admin: admin,
          treasury: treasury,
          tokenFactory: tokenFactory,
          staker: staker,
        }
      })
    })
    ->Option.getExn
  }

  let mock_seedMarketInitiallyToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_seedMarketInitially")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._seedMarketInitiallyMock.will.return()")
    })
  }

  type _seedMarketInitiallyCall = {
    initialMarketSeedForEachMarketSide: Ethers.BigNumber.t,
    marketIndex: int,
  }

  let _seedMarketInitiallyCalls: unit => array<_seedMarketInitiallyCall> = () => {
    checkForExceptions(~functionName="_seedMarketInitially")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._seedMarketInitiallyMock.calls")
      array->Array.map(((initialMarketSeedForEachMarketSide, marketIndex)) => {
        {
          initialMarketSeedForEachMarketSide: initialMarketSeedForEachMarketSide,
          marketIndex: marketIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getMinToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_getMin")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._getMinMock.will.return.with([_param0])")
    })
  }

  type _getMinCall = {
    a: Ethers.BigNumber.t,
    b: Ethers.BigNumber.t,
  }

  let _getMinCalls: unit => array<_getMinCall> = () => {
    checkForExceptions(~functionName="_getMin")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getMinMock.calls")
      array->Array.map(((a, b)) => {
        {
          a: a,
          b: b,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getSyntheticTokenPriceToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_getSyntheticTokenPrice")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._getSyntheticTokenPriceMock.will.return.with([_param0])")
    })
  }

  type _getSyntheticTokenPriceCall = {
    amountPaymentTokenBackingSynth: Ethers.BigNumber.t,
    amountSyntheticToken: Ethers.BigNumber.t,
  }

  let _getSyntheticTokenPriceCalls: unit => array<_getSyntheticTokenPriceCall> = () => {
    checkForExceptions(~functionName="_getSyntheticTokenPrice")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getSyntheticTokenPriceMock.calls")
      array->Array.map(((amountPaymentTokenBackingSynth, amountSyntheticToken)) => {
        {
          amountPaymentTokenBackingSynth: amountPaymentTokenBackingSynth,
          amountSyntheticToken: amountSyntheticToken,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getAmountPaymentTokenToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_getAmountPaymentToken")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._getAmountPaymentTokenMock.will.return.with([_param0])")
    })
  }

  type _getAmountPaymentTokenCall = {
    amountSyntheticToken: Ethers.BigNumber.t,
    syntheticTokenPriceInPaymentTokens: Ethers.BigNumber.t,
  }

  let _getAmountPaymentTokenCalls: unit => array<_getAmountPaymentTokenCall> = () => {
    checkForExceptions(~functionName="_getAmountPaymentToken")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getAmountPaymentTokenMock.calls")
      array->Array.map(((amountSyntheticToken, syntheticTokenPriceInPaymentTokens)) => {
        {
          amountSyntheticToken: amountSyntheticToken,
          syntheticTokenPriceInPaymentTokens: syntheticTokenPriceInPaymentTokens,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getAmountSyntheticTokenToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_getAmountSyntheticToken")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._getAmountSyntheticTokenMock.will.return.with([_param0])")
    })
  }

  type _getAmountSyntheticTokenCall = {
    amountPaymentTokenBackingSynth: Ethers.BigNumber.t,
    syntheticTokenPriceInPaymentTokens: Ethers.BigNumber.t,
  }

  let _getAmountSyntheticTokenCalls: unit => array<_getAmountSyntheticTokenCall> = () => {
    checkForExceptions(~functionName="_getAmountSyntheticToken")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getAmountSyntheticTokenMock.calls")
      array->Array.map(((amountPaymentTokenBackingSynth, syntheticTokenPriceInPaymentTokens)) => {
        {
          amountPaymentTokenBackingSynth: amountPaymentTokenBackingSynth,
          syntheticTokenPriceInPaymentTokens: syntheticTokenPriceInPaymentTokens,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getEquivalentAmountSyntheticTokensOnTargetSideToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="_getEquivalentAmountSyntheticTokensOnTargetSide")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._getEquivalentAmountSyntheticTokensOnTargetSideMock.will.return.with([_param0])"
      )
    })
  }

  type _getEquivalentAmountSyntheticTokensOnTargetSideCall = {
    amountSyntheticTokens_originSide: Ethers.BigNumber.t,
    syntheticTokenPrice_originSide: Ethers.BigNumber.t,
    syntheticTokenPrice_targetSide: Ethers.BigNumber.t,
  }

  let _getEquivalentAmountSyntheticTokensOnTargetSideCalls: unit => array<
    _getEquivalentAmountSyntheticTokensOnTargetSideCall,
  > = () => {
    checkForExceptions(~functionName="_getEquivalentAmountSyntheticTokensOnTargetSide")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getEquivalentAmountSyntheticTokensOnTargetSideMock.calls")
      array->Array.map(((
        amountSyntheticTokens_originSide,
        syntheticTokenPrice_originSide,
        syntheticTokenPrice_targetSide,
      )) => {
        {
          amountSyntheticTokens_originSide: amountSyntheticTokens_originSide,
          syntheticTokenPrice_originSide: syntheticTokenPrice_originSide,
          syntheticTokenPrice_targetSide: syntheticTokenPrice_targetSide,
        }
      })
    })
    ->Option.getExn
  }

  let mockGetAmountSyntheticTokenToMintOnTargetSideToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="getAmountSyntheticTokenToMintOnTargetSide")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked.getAmountSyntheticTokenToMintOnTargetSideMock.will.return.with([_param0])"
      )
    })
  }

  type getAmountSyntheticTokenToMintOnTargetSideCall = {
    marketIndex: int,
    amountSyntheticToken_redeemOnOriginSide: Ethers.BigNumber.t,
    isShiftFromLong: bool,
    priceSnapshotIndex: Ethers.BigNumber.t,
  }

  let getAmountSyntheticTokenToMintOnTargetSideCalls: unit => array<
    getAmountSyntheticTokenToMintOnTargetSideCall,
  > = () => {
    checkForExceptions(~functionName="getAmountSyntheticTokenToMintOnTargetSide")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.getAmountSyntheticTokenToMintOnTargetSideMock.calls")
      array->Array.map(((
        marketIndex,
        amountSyntheticToken_redeemOnOriginSide,
        isShiftFromLong,
        priceSnapshotIndex,
      )) => {
        {
          marketIndex: marketIndex,
          amountSyntheticToken_redeemOnOriginSide: amountSyntheticToken_redeemOnOriginSide,
          isShiftFromLong: isShiftFromLong,
          priceSnapshotIndex: priceSnapshotIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mockGetUsersConfirmedButNotSettledSynthBalanceToReturn: Ethers.BigNumber.t => unit = _param0 => {
    checkForExceptions(~functionName="getUsersConfirmedButNotSettledSynthBalance")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked.getUsersConfirmedButNotSettledSynthBalanceMock.will.return.with([_param0])"
      )
    })
  }

  type getUsersConfirmedButNotSettledSynthBalanceCall = {
    user: Ethers.ethAddress,
    marketIndex: int,
    isLong: bool,
  }

  let getUsersConfirmedButNotSettledSynthBalanceCalls: unit => array<
    getUsersConfirmedButNotSettledSynthBalanceCall,
  > = () => {
    checkForExceptions(~functionName="getUsersConfirmedButNotSettledSynthBalance")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked.getUsersConfirmedButNotSettledSynthBalanceMock.calls")
      array->Array.map(((user, marketIndex, isLong)) => {
        {
          user: user,
          marketIndex: marketIndex,
          isLong: isLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_getYieldSplitToReturn: (bool, Ethers.BigNumber.t) => unit = (_param0, _param1) => {
    checkForExceptions(~functionName="_getYieldSplit")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._getYieldSplitMock.will.return.with([_param0,_param1])")
    })
  }

  type _getYieldSplitCall = {
    marketIndex: int,
    longValue: Ethers.BigNumber.t,
    shortValue: Ethers.BigNumber.t,
    totalValueLockedInMarket: Ethers.BigNumber.t,
  }

  let _getYieldSplitCalls: unit => array<_getYieldSplitCall> = () => {
    checkForExceptions(~functionName="_getYieldSplit")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._getYieldSplitMock.calls")
      array->Array.map(((marketIndex, longValue, shortValue, totalValueLockedInMarket)) => {
        {
          marketIndex: marketIndex,
          longValue: longValue,
          shortValue: shortValue,
          totalValueLockedInMarket: totalValueLockedInMarket,
        }
      })
    })
    ->Option.getExn
  }

  let mock_claimAndDistributeYieldThenRebalanceMarketToReturn: (
    Ethers.BigNumber.t,
    Ethers.BigNumber.t,
  ) => unit = (_param0, _param1) => {
    checkForExceptions(~functionName="_claimAndDistributeYieldThenRebalanceMarket")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._claimAndDistributeYieldThenRebalanceMarketMock.will.return.with([_param0,_param1])"
      )
    })
  }

  type _claimAndDistributeYieldThenRebalanceMarketCall = {
    marketIndex: int,
    newAssetPrice: Ethers.BigNumber.t,
    oldAssetPrice: Ethers.BigNumber.t,
  }

  let _claimAndDistributeYieldThenRebalanceMarketCalls: unit => array<
    _claimAndDistributeYieldThenRebalanceMarketCall,
  > = () => {
    checkForExceptions(~functionName="_claimAndDistributeYieldThenRebalanceMarket")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._claimAndDistributeYieldThenRebalanceMarketMock.calls")
      array->Array.map(((marketIndex, newAssetPrice, oldAssetPrice)) => {
        {
          marketIndex: marketIndex,
          newAssetPrice: newAssetPrice,
          oldAssetPrice: oldAssetPrice,
        }
      })
    })
    ->Option.getExn
  }

  let mock_updateSystemStateInternalToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_updateSystemStateInternal")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._updateSystemStateInternalMock.will.return()")
    })
  }

  type _updateSystemStateInternalCall = {marketIndex: int}

  let _updateSystemStateInternalCalls: unit => array<_updateSystemStateInternalCall> = () => {
    checkForExceptions(~functionName="_updateSystemStateInternal")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._updateSystemStateInternalMock.calls")
      array->Array.map(_m => {
        let marketIndex = _m->Array.getUnsafe(0)

        {
          marketIndex: marketIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mock_transferPaymentTokensFromUserToYieldManagerToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_transferPaymentTokensFromUserToYieldManager")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._transferPaymentTokensFromUserToYieldManagerMock.will.return()")
    })
  }

  type _transferPaymentTokensFromUserToYieldManagerCall = {
    marketIndex: int,
    amount: Ethers.BigNumber.t,
  }

  let _transferPaymentTokensFromUserToYieldManagerCalls: unit => array<
    _transferPaymentTokensFromUserToYieldManagerCall,
  > = () => {
    checkForExceptions(~functionName="_transferPaymentTokensFromUserToYieldManager")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._transferPaymentTokensFromUserToYieldManagerMock.calls")
      array->Array.map(((marketIndex, amount)) => {
        {
          marketIndex: marketIndex,
          amount: amount,
        }
      })
    })
    ->Option.getExn
  }

  let mock_mintNextPriceToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_mintNextPrice")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._mintNextPriceMock.will.return()")
    })
  }

  type _mintNextPriceCall = {
    marketIndex: int,
    amount: Ethers.BigNumber.t,
    isLong: bool,
  }

  let _mintNextPriceCalls: unit => array<_mintNextPriceCall> = () => {
    checkForExceptions(~functionName="_mintNextPrice")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._mintNextPriceMock.calls")
      array->Array.map(((marketIndex, amount, isLong)) => {
        {
          marketIndex: marketIndex,
          amount: amount,
          isLong: isLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_redeemNextPriceToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_redeemNextPrice")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._redeemNextPriceMock.will.return()")
    })
  }

  type _redeemNextPriceCall = {
    marketIndex: int,
    tokens_redeem: Ethers.BigNumber.t,
    isLong: bool,
  }

  let _redeemNextPriceCalls: unit => array<_redeemNextPriceCall> = () => {
    checkForExceptions(~functionName="_redeemNextPrice")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._redeemNextPriceMock.calls")
      array->Array.map(((marketIndex, tokens_redeem, isLong)) => {
        {
          marketIndex: marketIndex,
          tokens_redeem: tokens_redeem,
          isLong: isLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_shiftPositionNextPriceToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_shiftPositionNextPrice")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._shiftPositionNextPriceMock.will.return()")
    })
  }

  type _shiftPositionNextPriceCall = {
    marketIndex: int,
    amountSyntheticTokensToShift: Ethers.BigNumber.t,
    isShiftFromLong: bool,
  }

  let _shiftPositionNextPriceCalls: unit => array<_shiftPositionNextPriceCall> = () => {
    checkForExceptions(~functionName="_shiftPositionNextPrice")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._shiftPositionNextPriceMock.calls")
      array->Array.map(((marketIndex, amountSyntheticTokensToShift, isShiftFromLong)) => {
        {
          marketIndex: marketIndex,
          amountSyntheticTokensToShift: amountSyntheticTokensToShift,
          isShiftFromLong: isShiftFromLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_executeOutstandingNextPriceMintsToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceMints")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._executeOutstandingNextPriceMintsMock.will.return()")
    })
  }

  type _executeOutstandingNextPriceMintsCall = {
    marketIndex: int,
    user: Ethers.ethAddress,
    isLong: bool,
  }

  let _executeOutstandingNextPriceMintsCalls: unit => array<
    _executeOutstandingNextPriceMintsCall,
  > = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceMints")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._executeOutstandingNextPriceMintsMock.calls")
      array->Array.map(((marketIndex, user, isLong)) => {
        {
          marketIndex: marketIndex,
          user: user,
          isLong: isLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_executeOutstandingNextPriceRedeemsToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceRedeems")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._executeOutstandingNextPriceRedeemsMock.will.return()")
    })
  }

  type _executeOutstandingNextPriceRedeemsCall = {
    marketIndex: int,
    user: Ethers.ethAddress,
    isLong: bool,
  }

  let _executeOutstandingNextPriceRedeemsCalls: unit => array<
    _executeOutstandingNextPriceRedeemsCall,
  > = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceRedeems")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._executeOutstandingNextPriceRedeemsMock.calls")
      array->Array.map(((marketIndex, user, isLong)) => {
        {
          marketIndex: marketIndex,
          user: user,
          isLong: isLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_executeOutstandingNextPriceTokenShiftsToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceTokenShifts")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._executeOutstandingNextPriceTokenShiftsMock.will.return()")
    })
  }

  type _executeOutstandingNextPriceTokenShiftsCall = {
    marketIndex: int,
    user: Ethers.ethAddress,
    isShiftFromLong: bool,
  }

  let _executeOutstandingNextPriceTokenShiftsCalls: unit => array<
    _executeOutstandingNextPriceTokenShiftsCall,
  > = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceTokenShifts")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._executeOutstandingNextPriceTokenShiftsMock.calls")
      array->Array.map(((marketIndex, user, isShiftFromLong)) => {
        {
          marketIndex: marketIndex,
          user: user,
          isShiftFromLong: isShiftFromLong,
        }
      })
    })
    ->Option.getExn
  }

  let mock_executeOutstandingNextPriceSettlementsToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceSettlements")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._executeOutstandingNextPriceSettlementsMock.will.return()")
    })
  }

  type _executeOutstandingNextPriceSettlementsCall = {
    user: Ethers.ethAddress,
    marketIndex: int,
  }

  let _executeOutstandingNextPriceSettlementsCalls: unit => array<
    _executeOutstandingNextPriceSettlementsCall,
  > = () => {
    checkForExceptions(~functionName="_executeOutstandingNextPriceSettlements")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._executeOutstandingNextPriceSettlementsMock.calls")
      array->Array.map(((user, marketIndex)) => {
        {
          user: user,
          marketIndex: marketIndex,
        }
      })
    })
    ->Option.getExn
  }

  let mock_handleTotalPaymentTokenValueChangeForMarketWithYieldManagerToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_handleTotalPaymentTokenValueChangeForMarketWithYieldManager")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._handleTotalPaymentTokenValueChangeForMarketWithYieldManagerMock.will.return()"
      )
    })
  }

  type _handleTotalPaymentTokenValueChangeForMarketWithYieldManagerCall = {
    marketIndex: int,
    totalPaymentTokenValueChangeForMarket: Ethers.BigNumber.t,
  }

  let _handleTotalPaymentTokenValueChangeForMarketWithYieldManagerCalls: unit => array<
    _handleTotalPaymentTokenValueChangeForMarketWithYieldManagerCall,
  > = () => {
    checkForExceptions(~functionName="_handleTotalPaymentTokenValueChangeForMarketWithYieldManager")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw(
        "_r.smocked._handleTotalPaymentTokenValueChangeForMarketWithYieldManagerMock.calls"
      )
      array->Array.map(((marketIndex, totalPaymentTokenValueChangeForMarket)) => {
        {
          marketIndex: marketIndex,
          totalPaymentTokenValueChangeForMarket: totalPaymentTokenValueChangeForMarket,
        }
      })
    })
    ->Option.getExn
  }

  let mock_handleChangeInSyntheticTokensTotalSupplyToReturn: unit => unit = () => {
    checkForExceptions(~functionName="_handleChangeInSyntheticTokensTotalSupply")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw("_r.smocked._handleChangeInSyntheticTokensTotalSupplyMock.will.return()")
    })
  }

  type _handleChangeInSyntheticTokensTotalSupplyCall = {
    marketIndex: int,
    isLong: bool,
    changeInSyntheticTokensTotalSupply: Ethers.BigNumber.t,
  }

  let _handleChangeInSyntheticTokensTotalSupplyCalls: unit => array<
    _handleChangeInSyntheticTokensTotalSupplyCall,
  > = () => {
    checkForExceptions(~functionName="_handleChangeInSyntheticTokensTotalSupply")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._handleChangeInSyntheticTokensTotalSupplyMock.calls")
      array->Array.map(((marketIndex, isLong, changeInSyntheticTokensTotalSupply)) => {
        {
          marketIndex: marketIndex,
          isLong: isLong,
          changeInSyntheticTokensTotalSupply: changeInSyntheticTokensTotalSupply,
        }
      })
    })
    ->Option.getExn
  }

  let mock_batchConfirmOutstandingPendingActionsToReturn: (
    Ethers.BigNumber.t,
    Ethers.BigNumber.t,
  ) => unit = (_param0, _param1) => {
    checkForExceptions(~functionName="_batchConfirmOutstandingPendingActions")
    let _ = internalRef.contents->Option.map(_r => {
      let _ = %raw(
        "_r.smocked._batchConfirmOutstandingPendingActionsMock.will.return.with([_param0,_param1])"
      )
    })
  }

  type _batchConfirmOutstandingPendingActionsCall = {
    marketIndex: int,
    syntheticTokenPrice_inPaymentTokens_long: Ethers.BigNumber.t,
    syntheticTokenPrice_inPaymentTokens_short: Ethers.BigNumber.t,
  }

  let _batchConfirmOutstandingPendingActionsCalls: unit => array<
    _batchConfirmOutstandingPendingActionsCall,
  > = () => {
    checkForExceptions(~functionName="_batchConfirmOutstandingPendingActions")
    internalRef.contents
    ->Option.map(_r => {
      let array = %raw("_r.smocked._batchConfirmOutstandingPendingActionsMock.calls")
      array->Array.map(((
        marketIndex,
        syntheticTokenPrice_inPaymentTokens_long,
        syntheticTokenPrice_inPaymentTokens_short,
      )) => {
        {
          marketIndex: marketIndex,
          syntheticTokenPrice_inPaymentTokens_long: syntheticTokenPrice_inPaymentTokens_long,
          syntheticTokenPrice_inPaymentTokens_short: syntheticTokenPrice_inPaymentTokens_short,
        }
      })
    })
    ->Option.getExn
  }
}

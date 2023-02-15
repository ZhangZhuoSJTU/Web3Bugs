type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: YieldManagerMock.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockTEN_TO_THE_18ToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.TEN_TO_THE_18.will.return.with([_param0])")
}

type tEN_TO_THE_18Call

let tEN_TO_THE_18Calls: t => array<tEN_TO_THE_18Call> = _r => {
  let array = %raw("_r.smocked.TEN_TO_THE_18.calls")
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

let mockDepositPaymentTokenToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.depositPaymentToken.will.return()")
}

type depositPaymentTokenCall = {amount: Ethers.BigNumber.t}

let depositPaymentTokenCalls: t => array<depositPaymentTokenCall> = _r => {
  let array = %raw("_r.smocked.depositPaymentToken.calls")
  array->Array.map(_m => {
    let amount = _m->Array.getUnsafe(0)

    {
      amount: amount,
    }
  })
}

let mockDistributeYieldForTreasuryAndReturnMarketAllocationToReturn: (
  t,
  Ethers.BigNumber.t,
) => unit = (_r, _param0) => {
  let _ = %raw(
    "_r.smocked.distributeYieldForTreasuryAndReturnMarketAllocation.will.return.with([_param0])"
  )
}

type distributeYieldForTreasuryAndReturnMarketAllocationCall = {
  totalValueRealizedForMarket: Ethers.BigNumber.t,
  treasuryYieldPercent_e18: Ethers.BigNumber.t,
}

let distributeYieldForTreasuryAndReturnMarketAllocationCalls: t => array<
  distributeYieldForTreasuryAndReturnMarketAllocationCall,
> = _r => {
  let array = %raw("_r.smocked.distributeYieldForTreasuryAndReturnMarketAllocation.calls")
  array->Array.map(((totalValueRealizedForMarket, treasuryYieldPercent_e18)) => {
    {
      totalValueRealizedForMarket: totalValueRealizedForMarket,
      treasuryYieldPercent_e18: treasuryYieldPercent_e18,
    }
  })
}

let mockLastSettledToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.lastSettled.will.return.with([_param0])")
}

type lastSettledCall

let lastSettledCalls: t => array<lastSettledCall> = _r => {
  let array = %raw("_r.smocked.lastSettled.calls")
  array->Array.map(() => {
    ()->Obj.magic
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

let mockRemovePaymentTokenFromMarketToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.removePaymentTokenFromMarket.will.return()")
}

type removePaymentTokenFromMarketCall = {amount: Ethers.BigNumber.t}

let removePaymentTokenFromMarketCalls: t => array<removePaymentTokenFromMarketCall> = _r => {
  let array = %raw("_r.smocked.removePaymentTokenFromMarket.calls")
  array->Array.map(_m => {
    let amount = _m->Array.getUnsafe(0)

    {
      amount: amount,
    }
  })
}

let mockSetYieldRateToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.setYieldRate.will.return()")
}

type setYieldRateCall = {yieldRate: Ethers.BigNumber.t}

let setYieldRateCalls: t => array<setYieldRateCall> = _r => {
  let array = %raw("_r.smocked.setYieldRate.calls")
  array->Array.map(_m => {
    let yieldRate = _m->Array.getUnsafe(0)

    {
      yieldRate: yieldRate,
    }
  })
}

let mockSettleToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.settle.will.return()")
}

type settleCall

let settleCalls: t => array<settleCall> = _r => {
  let array = %raw("_r.smocked.settle.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockSettleWithYieldAbsoluteToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.settleWithYieldAbsolute.will.return()")
}

type settleWithYieldAbsoluteCall = {totalYield: Ethers.BigNumber.t}

let settleWithYieldAbsoluteCalls: t => array<settleWithYieldAbsoluteCall> = _r => {
  let array = %raw("_r.smocked.settleWithYieldAbsolute.calls")
  array->Array.map(_m => {
    let totalYield = _m->Array.getUnsafe(0)

    {
      totalYield: totalYield,
    }
  })
}

let mockSettleWithYieldPercentToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.settleWithYieldPercent.will.return()")
}

type settleWithYieldPercentCall = {yieldPercent: Ethers.BigNumber.t}

let settleWithYieldPercentCalls: t => array<settleWithYieldPercentCall> = _r => {
  let array = %raw("_r.smocked.settleWithYieldPercent.calls")
  array->Array.map(_m => {
    let yieldPercent = _m->Array.getUnsafe(0)

    {
      yieldPercent: yieldPercent,
    }
  })
}

let mockTokenToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.token.will.return.with([_param0])")
}

type tokenCall

let tokenCalls: t => array<tokenCall> = _r => {
  let array = %raw("_r.smocked.token.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockTokenOtherRewardERC20ToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.tokenOtherRewardERC20.will.return.with([_param0])")
}

type tokenOtherRewardERC20Call

let tokenOtherRewardERC20Calls: t => array<tokenOtherRewardERC20Call> = _r => {
  let array = %raw("_r.smocked.tokenOtherRewardERC20.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockTotalHeldToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.totalHeld.will.return.with([_param0])")
}

type totalHeldCall

let totalHeldCalls: t => array<totalHeldCall> = _r => {
  let array = %raw("_r.smocked.totalHeld.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockTotalReservedForTreasuryToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.totalReservedForTreasury.will.return.with([_param0])")
}

type totalReservedForTreasuryCall

let totalReservedForTreasuryCalls: t => array<totalReservedForTreasuryCall> = _r => {
  let array = %raw("_r.smocked.totalReservedForTreasury.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockTransferPaymentTokensToUserToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.transferPaymentTokensToUser.will.return()")
}

type transferPaymentTokensToUserCall = {
  user: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
}

let transferPaymentTokensToUserCalls: t => array<transferPaymentTokensToUserCall> = _r => {
  let array = %raw("_r.smocked.transferPaymentTokensToUser.calls")
  array->Array.map(((user, amount)) => {
    {
      user: user,
      amount: amount,
    }
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

let mockWithdrawTreasuryFundsToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.withdrawTreasuryFunds.will.return()")
}

type withdrawTreasuryFundsCall

let withdrawTreasuryFundsCalls: t => array<withdrawTreasuryFundsCall> = _r => {
  let array = %raw("_r.smocked.withdrawTreasuryFunds.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockYieldRateToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.yieldRate.will.return.with([_param0])")
}

type yieldRateCall

let yieldRateCalls: t => array<yieldRateCall> = _r => {
  let array = %raw("_r.smocked.yieldRate.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

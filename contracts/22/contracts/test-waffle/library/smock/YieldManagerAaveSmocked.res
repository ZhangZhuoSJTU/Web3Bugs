type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: YieldManagerAave.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockATokenToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.aToken.will.return.with([_param0])")
}

type aTokenCall

let aTokenCalls: t => array<aTokenCall> = _r => {
  let array = %raw("_r.smocked.aToken.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockAaveIncentivesControllerToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.aaveIncentivesController.will.return.with([_param0])")
}

type aaveIncentivesControllerCall

let aaveIncentivesControllerCalls: t => array<aaveIncentivesControllerCall> = _r => {
  let array = %raw("_r.smocked.aaveIncentivesController.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockAmountReservedInCaseOfInsufficientAaveLiquidityToReturn: (t, Ethers.BigNumber.t) => unit = (
  _r,
  _param0,
) => {
  let _ = %raw(
    "_r.smocked.amountReservedInCaseOfInsufficientAaveLiquidity.will.return.with([_param0])"
  )
}

type amountReservedInCaseOfInsufficientAaveLiquidityCall

let amountReservedInCaseOfInsufficientAaveLiquidityCalls: t => array<
  amountReservedInCaseOfInsufficientAaveLiquidityCall,
> = _r => {
  let array = %raw("_r.smocked.amountReservedInCaseOfInsufficientAaveLiquidity.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockClaimAaveRewardsToTreasuryToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.claimAaveRewardsToTreasury.will.return()")
}

type claimAaveRewardsToTreasuryCall

let claimAaveRewardsToTreasuryCalls: t => array<claimAaveRewardsToTreasuryCall> = _r => {
  let array = %raw("_r.smocked.claimAaveRewardsToTreasury.calls")
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

let mockLendingPoolToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.lendingPool.will.return.with([_param0])")
}

type lendingPoolCall

let lendingPoolCalls: t => array<lendingPoolCall> = _r => {
  let array = %raw("_r.smocked.lendingPool.calls")
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

let mockPaymentTokenToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.paymentToken.will.return.with([_param0])")
}

type paymentTokenCall

let paymentTokenCalls: t => array<paymentTokenCall> = _r => {
  let array = %raw("_r.smocked.paymentToken.calls")
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

type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: LendingPoolAaveMock.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockDepositToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.deposit.will.return()")
}

type depositCall = {
  asset: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
  onBehalfOf: Ethers.ethAddress,
  referralCode: int,
}

let depositCalls: t => array<depositCall> = _r => {
  let array = %raw("_r.smocked.deposit.calls")
  array->Array.map(((asset, amount, onBehalfOf, referralCode)) => {
    {
      asset: asset,
      amount: amount,
      onBehalfOf: onBehalfOf,
      referralCode: referralCode,
    }
  })
}

let mockWithdrawToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.withdraw.will.return.with([_param0])")
}

type withdrawCall = {
  asset: Ethers.ethAddress,
  amount: Ethers.BigNumber.t,
  _to: Ethers.ethAddress,
}

let withdrawCalls: t => array<withdrawCall> = _r => {
  let array = %raw("_r.smocked.withdraw.calls")
  array->Array.map(((asset, amount, _to)) => {
    {
      asset: asset,
      amount: amount,
      _to: _to,
    }
  })
}

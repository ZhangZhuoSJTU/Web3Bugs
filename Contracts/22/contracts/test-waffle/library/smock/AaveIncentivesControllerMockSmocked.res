type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock")
external make: AaveIncentivesControllerMock.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

let mockClaimRewardsToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.claimRewards.will.return.with([_param0])")
}

type claimRewardsCall = {
  assets: array<Ethers.ethAddress>,
  amount: Ethers.BigNumber.t,
  _to: Ethers.ethAddress,
}

let claimRewardsCalls: t => array<claimRewardsCall> = _r => {
  let array = %raw("_r.smocked.claimRewards.calls")
  array->Array.map(((assets, amount, _to)) => {
    {
      assets: assets,
      amount: amount,
      _to: _to,
    }
  })
}

let mockGetUserUnclaimedRewardsToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.getUserUnclaimedRewards.will.return.with([_param0])")
}

type getUserUnclaimedRewardsCall = {user: Ethers.ethAddress}

let getUserUnclaimedRewardsCalls: t => array<getUserUnclaimedRewardsCall> = _r => {
  let array = %raw("_r.smocked.getUserUnclaimedRewards.calls")
  array->Array.map(_m => {
    let user = _m->Array.getUnsafe(0)

    {
      user: user,
    }
  })
}

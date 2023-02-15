type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock")
external make: OracleManagerChainlink.t => Js.Promise.t<t> = "smockit"

let uninitializedValue: t = None->Obj.magic

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

let mockChainlinkOracleToReturn: (t, Ethers.ethAddress) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.chainlinkOracle.will.return.with([_param0])")
}

type chainlinkOracleCall

let chainlinkOracleCalls: t => array<chainlinkOracleCall> = _r => {
  let array = %raw("_r.smocked.chainlinkOracle.calls")
  array->Array.map(() => {
    ()->Obj.magic
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

let mockGetLatestPriceToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.getLatestPrice.will.return.with([_param0])")
}

type getLatestPriceCall

let getLatestPriceCalls: t => array<getLatestPriceCall> = _r => {
  let array = %raw("_r.smocked.getLatestPrice.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockOracleDecimalsToReturn: (t, int) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.oracleDecimals.will.return.with([_param0])")
}

type oracleDecimalsCall

let oracleDecimalsCalls: t => array<oracleDecimalsCall> = _r => {
  let array = %raw("_r.smocked.oracleDecimals.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

let mockUpdatePriceToReturn: (t, Ethers.BigNumber.t) => unit = (_r, _param0) => {
  let _ = %raw("_r.smocked.updatePrice.will.return.with([_param0])")
}

type updatePriceCall

let updatePriceCalls: t => array<updatePriceCall> = _r => {
  let array = %raw("_r.smocked.updatePrice.calls")
  array->Array.map(() => {
    ()->Obj.magic
  })
}

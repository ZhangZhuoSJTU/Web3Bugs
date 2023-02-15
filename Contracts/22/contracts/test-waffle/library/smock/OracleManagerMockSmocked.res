type t = {address: Ethers.ethAddress}

@module("@eth-optimism/smock") external make: OracleManagerMock.t => Js.Promise.t<t> = "smockit"

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

let mockSetPriceToReturn: t => unit = _r => {
  let _ = %raw("_r.smocked.setPrice.will.return()")
}

type setPriceCall = {newPrice: Ethers.BigNumber.t}

let setPriceCalls: t => array<setPriceCall> = _r => {
  let array = %raw("_r.smocked.setPrice.calls")
  array->Array.map(_m => {
    let newPrice = _m->Array.getUnsafe(0)

    {
      newPrice: newPrice,
    }
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
